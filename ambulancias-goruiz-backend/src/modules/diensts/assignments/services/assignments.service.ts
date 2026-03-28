import mongoose from "mongoose";
import { DateTime } from "luxon";
import Dienst from "../../models/dienst.model";
import User from "../../../users/models/user.model";
import { Team } from "../../../teams";
import { Ambulance } from "../../../ambulances";
import type { AssignedDay } from "../../types/dienst.types";
import {
  findWeeklyConflicts,
  isAmbulanceRoleValidForSlot,
  isDriverEligibleForAssignmentDate,
  isOnVacationDay,
  isOnSickDay,
  computeDayBlockMapForTeam,
} from "../../utils/dienstValidation";
import { extractValidDatesFromAssignments, mapAssignmentToAssignedDay } from "../../utils/dienstMappers";
import { entitiesBelongToSameCompany } from "../../../../utils/requireCompany";
import { DienstAssignmentError } from "./assignment-errors";

const BERLIN = "Europe/Berlin";

function normalizeDayKey(date: string): string {
  const s = String(date).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1]!;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return DateTime.fromJSDate(d, { zone: BERLIN }).toFormat("yyyy-MM-dd");
}

function weekStartMondayBerlin(d: unknown): string | null {
  if (d == null) return null;
  const dt = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(dt.getTime())) return null;
  return DateTime.fromJSDate(dt, { zone: BERLIN }).startOf("week").toISODate() ?? null;
}

function oidStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as mongoose.Types.ObjectId).toString?.() ?? v);
  }
  return String(v);
}

export async function getAssignedDaysForUser(
  userId: string,
  userCompanyId?: string | null,
): Promise<AssignedDay[]> {
  const callerCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : null;
  if (!callerCo) {
    return [];
  }

  const baseFilter = {
    $or: [
      { "assignments.driver": new mongoose.Types.ObjectId(userId) },
      { "assignments.medic": new mongoose.Types.ObjectId(userId) },
    ],
  };
  const filter = {
    $and: [
      baseFilter,
      { companyId: new mongoose.Types.ObjectId(callerCo) },
    ],
  };
  const diensts = await Dienst.find(filter)
    .populate("assignments.driver", "name lastName pscheinExpiry")
    .populate("assignments.medic", "name lastName pscheinExpiry")
    .populate("assignments.ambulanceId", "ambulanceNumber")
    .lean();

  const assignedDays: AssignedDay[] = [];

  diensts.forEach((dienst: { _id: unknown; dienstNumber: number; assignments: unknown[] }) => {
    dienst.assignments.forEach((assignment) => {
      const mapped = mapAssignmentToAssignedDay(assignment, dienst, userId);
      if (mapped) assignedDays.push(mapped);
    });
  });

  return assignedDays;
}

export async function removeAssignment(
  dienstId: string,
  date: string,
  companyId?: string | null,
) {
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!callerCo) return null;

  const dienst = await Dienst.findById(dienstId).select("companyId").lean();
  if (!dienst) return null;

  const dc = (dienst as any).companyId;
  if (!dc) return null;
  if (String(dc) !== callerCo) return null;

  return Dienst.findByIdAndUpdate(
    dienstId,
    { $pull: { assignments: { date } } },
    { new: true },
  )
    .populate("assignments.driver", "name lastName pscheinExpiry")
    .populate("assignments.medic", "name lastName pscheinExpiry")
    .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate");
}

export async function clearPeopleForWeek(
  params: {
    dienstNumber: number;
    weekStartDate: string;
  },
  companyId?: string | null,
): Promise<{
  message: string;
  clearedCount: number;
  dienstId: string;
  weekStartDate: string;
}> {
  const { dienstNumber, weekStartDate } = params;
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!callerCo) {
    throw new DienstAssignmentError(
      403,
      "forbidden",
      "No tienes permiso para modificar este Dienst",
    );
  }

  const start = new Date(weekStartDate);

  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: {
      $gte: start,
      $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
    },
    companyId: new mongoose.Types.ObjectId(callerCo),
  });

  if (!dienst) {
    throw new DienstAssignmentError(
      404,
      "dienst_not_found",
      "No existe Dienst para esa semana y número",
    );
  }

  let clearedCount = 0;

  dienst.assignments = dienst.assignments.map((a) => {
    if (!a?.date || !a?.startTime || !a?.endTime) return a;
    const hadSomething = !!a.driver || !!a.medic || !!a.ambulanceId;
    if (hadSomething) clearedCount += 1;

    return {
      ...a,
      driver: undefined,
      medic: undefined,
      ambulanceId: undefined,
    } as any;
  });

  (dienst as any).weekTeamId = null;
  await dienst.save();

  return {
    message: `Asignaciones (driver/medic/ambulancia) limpiadas para Dienst #${dienstNumber} (${weekStartDate}).`,
    clearedCount,
    dienstId: dienst.id,
    weekStartDate,
  };
}

async function validateAssignmentEntities(
  assignments: any[],
  dienstCompanyId: string | null,
) {
  const toStr = (v: unknown) =>
    v == null ? "" : typeof v === "string" ? v : String((v as { toString?: () => string })?.toString?.() ?? v);
  for (const a of assignments || []) {
    const ambId = toStr(a?.ambulanceId);
    if (ambId && ambId !== "") {
      const amb = await Ambulance.findById(ambId).select("companyId").lean();
      if (!amb) throw new DienstAssignmentError(404, "ambulance_not_found", "Ambulancia no encontrada");
      const ambCo = (amb as any).companyId;
      if (!entitiesBelongToSameCompany(ambCo, dienstCompanyId)) {
        throw new DienstAssignmentError(403, "forbidden", "La ambulancia no pertenece a tu empresa");
      }
    }
    const drvId = toStr(a?.driver);
    if (drvId && drvId !== "") {
      const u = await User.findById(drvId)
        .select("companyId ambulanceRole pscheinExpiry pscheinConfirmedAt")
        .lean();
      if (!u) throw new DienstAssignmentError(404, "user_not_found", "Conductor no encontrado");
      if (!entitiesBelongToSameCompany((u as any).companyId, dienstCompanyId)) {
        throw new DienstAssignmentError(403, "forbidden", "El conductor no pertenece a tu empresa");
      }
      const ar = (u as any).ambulanceRole as "driver" | "medic" | "both" | undefined;
      if (!isAmbulanceRoleValidForSlot(ar, "driver")) {
        throw new DienstAssignmentError(
          409,
          "invalid_ambulance_role",
          "El usuario no tiene rol de ambulancia válido para conductor.",
        );
      }
      const dateISO = typeof a?.date === "string" ? a.date.trim() : "";
      if (dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
        if (
          !isDriverEligibleForAssignmentDate({
            ambulanceRole: ar,
            pscheinExpiry: (u as any).pscheinExpiry,
            pscheinConfirmedAt: (u as any).pscheinConfirmedAt,
            assignmentDateISO: dateISO,
          })
        ) {
          throw new DienstAssignmentError(
            409,
            "pschein_invalid_for_date",
            "El P-Schein del conductor no es válido para la fecha del servicio.",
          );
        }
      }
    }
    const medId = toStr(a?.medic);
    if (medId && medId !== "") {
      const u = await User.findById(medId).select("companyId ambulanceRole").lean();
      if (!u) throw new DienstAssignmentError(404, "user_not_found", "Sanitario no encontrado");
      if (!entitiesBelongToSameCompany((u as any).companyId, dienstCompanyId)) {
        throw new DienstAssignmentError(403, "forbidden", "El sanitario no pertenece a tu empresa");
      }
      const ar = (u as any).ambulanceRole as "driver" | "medic" | "both" | undefined;
      if (!isAmbulanceRoleValidForSlot(ar, "medic")) {
        throw new DienstAssignmentError(
          409,
          "invalid_ambulance_role",
          "El usuario no tiene rol de ambulancia válido para sanitario.",
        );
      }
    }
    if (drvId && drvId !== "" && medId && medId !== "") {
      const ds = String(drvId).trim();
      const ms = String(medId).trim();
      const same =
        ds === ms ||
        (mongoose.Types.ObjectId.isValid(ds) &&
          mongoose.Types.ObjectId.isValid(ms) &&
          new mongoose.Types.ObjectId(ds).equals(new mongoose.Types.ObjectId(ms)));
      if (same) {
        throw new DienstAssignmentError(
          409,
          "driver_medic_same_user",
          "El conductor y el sanitario deben ser usuarios distintos.",
        );
      }
    }
  }
}

export async function updateDienstPartial(
  dienstId: string,
  assignments: any[],
  companyId?: string | null,
) {
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!callerCo) return null;

  const dienst = await Dienst.findById(dienstId);
  if (!dienst) return null;

  const dc = (dienst as any).companyId;
  if (!dc) return null;
  if (String(dc) !== callerCo) return null;

  const dienstCompanyId = String(dc);
  await validateAssignmentEntities(assignments, dienstCompanyId);

  for (const incoming of assignments) {
    const updatedCopy: any = { ...incoming };

    if (updatedCopy?._id === "") delete updatedCopy._id;
    if (updatedCopy?.driver === "") updatedCopy.driver = undefined;
    if (updatedCopy?.medic === "") updatedCopy.medic = undefined;

    const missingRequired =
      !updatedCopy?.date || !updatedCopy?.startTime || !updatedCopy?.endTime;

    if (missingRequired) {
      throw new DienstAssignmentError(
        400,
        "assignment_incomplete",
        "Faltan campos obligatorios en una fila de asignación (date, startTime, endTime).",
      );
    }

    const idx = dienst.assignments.findIndex(
      (a: any) => a.date === updatedCopy.date,
    );

    const hasAmbulanceField = Object.prototype.hasOwnProperty.call(
      incoming,
      "ambulanceId",
    );

    if (idx !== -1) {
      const prev = dienst.assignments[idx];

      const hasDriverField = Object.prototype.hasOwnProperty.call(
        incoming,
        "driver",
      );
      const hasMedicField = Object.prototype.hasOwnProperty.call(
        incoming,
        "medic",
      );

      prev.date = updatedCopy.date;
      prev.startTime = updatedCopy.startTime;
      prev.endTime = updatedCopy.endTime;

      if (hasDriverField) {
        const incomingDriver = (incoming as any).driver;
        if (incomingDriver === "" || incomingDriver === null) {
          (prev as any).driver = null;
          if ("driver" in prev) delete (prev as any).driver;
        } else {
          prev.driver = updatedCopy.driver;
        }
      }

      if (hasMedicField) {
        const incomingMedic = (incoming as any).medic;
        if (incomingMedic === "" || incomingMedic === null) {
          (prev as any).medic = null;
          if ("medic" in prev) delete (prev as any).medic;
        } else {
          prev.medic = updatedCopy.medic;
        }
      }

      if (hasAmbulanceField) {
        const amb = (incoming as any).ambulanceId;
        if (amb === "" || amb === null) {
          (prev as any).ambulanceId = null;
          if ("ambulanceId" in prev) delete (prev as any).ambulanceId;
        } else if (amb !== undefined) {
          (prev as any).ambulanceId = amb;
        }
      }

      dienst.assignments[idx] = prev as any;
    } else {
      const toInsert: any = {
        date: updatedCopy.date,
        startTime: updatedCopy.startTime,
        endTime: updatedCopy.endTime,
      };

      const hasDriverVal =
        updatedCopy?.driver !== undefined &&
        updatedCopy?.driver !== null &&
        updatedCopy?.driver !== "";
      const hasMedicVal =
        updatedCopy?.medic !== undefined &&
        updatedCopy?.medic !== null &&
        updatedCopy?.medic !== "";

      if (hasDriverVal) toInsert.driver = updatedCopy.driver;
      if (hasMedicVal) toInsert.medic = updatedCopy.medic;

      if (hasAmbulanceField) {
        const amb = (incoming as any).ambulanceId;
        if (amb && amb !== "" && amb !== null) {
          toInsert.ambulanceId = amb;
        }
      }

      dienst.assignments.push(toInsert);
    }
  }

  await dienst.save();

  return Dienst.findById(dienstId)
    .populate("assignments.driver", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.medic", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate");
}

export async function assignUserToWeek(
  params: {
    dienstNumber: number;
    weekStartDate: string;
    userId: string;
    role: "driver" | "medic";
  },
  companyId?: string | null,
): Promise<{
  message: string;
  updatedCount: number;
  skippedByVacation: string[];
  skippedBreakdown: { sick: number; vacation: number; both: number };
  dienstId: string;
  weekStartDate: string;
  role: string;
  userId: string;
}> {
  const { dienstNumber, weekStartDate, userId, role } = params;
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!callerCo) {
    throw new DienstAssignmentError(
      403,
      "forbidden",
      "No tienes permiso para modificar este Dienst",
    );
  }

  const start = new Date(weekStartDate);

  const user = await User.findById(userId)
    .select("pscheinExpiry pscheinConfirmedAt ambulanceRole companyId")
    .lean();
  if (!user) {
    throw new DienstAssignmentError(404, "user_not_found", "Usuario no encontrado");
  }

  if (role === "driver") {
    if (!isAmbulanceRoleValidForSlot((user as any).ambulanceRole, "driver")) {
      throw new DienstAssignmentError(
        409,
        "invalid_ambulance_role",
        "El usuario no tiene rol de ambulancia válido para conductor.",
      );
    }
  } else {
    if (!isAmbulanceRoleValidForSlot((user as any).ambulanceRole, "medic")) {
      throw new DienstAssignmentError(
        409,
        "invalid_ambulance_role",
        "El usuario no tiene rol de ambulancia válido para sanitario.",
      );
    }
  }

  const weeklyConf = await findWeeklyConflicts(
    new mongoose.Types.ObjectId(userId),
    start,
    dienstNumber,
  );
  const conflictDates = new Set(weeklyConf.map((c) => c.date));

  const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: { $gte: start, $lt: nextDay },
    companyId: new mongoose.Types.ObjectId(callerCo),
  });

  if (!dienst) {
    throw new DienstAssignmentError(
      404,
      "dienst_not_found",
      "No existe Dienst para esa semana y número",
    );
  }

  const dc = (dienst as any).companyId;
  if (!dc || String(dc) !== String(callerCo)) {
    throw new DienstAssignmentError(403, "forbidden", "No tienes permiso para modificar este Dienst");
  }
  if (!user.companyId || String(user.companyId) !== String(callerCo)) {
    throw new DienstAssignmentError(403, "forbidden", "El usuario no pertenece a tu empresa");
  }

  const dates = extractValidDatesFromAssignments(dienst.assignments);
  const vacationMap: Record<string, boolean> = {};
  const sickMap: Record<string, boolean> = {};

  await Promise.all(
    dates.map(async (dateISO) => {
      const [isVac, isSick] = await Promise.all([
        isOnVacationDay({ userId, dateISO }),
        isOnSickDay({ userId, dateISO }),
      ]);
      vacationMap[dateISO] = Boolean(isVac);
      sickMap[dateISO] = Boolean(isSick);
    }),
  );

  let updatedCount = 0;
  const skippedByVacation: string[] = [];
  const skippedBreakdown = { sick: 0, vacation: 0, both: 0 };

  dienst.assignments = dienst.assignments.map((a) => {
    if (!a?.date || !a?.startTime || !a?.endTime) return a;

    const isVac = !!vacationMap[a.date];
    const isSick = !!sickMap[a.date];

    if (isVac || isSick) {
      skippedByVacation.push(a.date);
      if (isVac && isSick) skippedBreakdown.both += 1;
      else if (isSick) skippedBreakdown.sick += 1;
      else if (isVac) skippedBreakdown.vacation += 1;
      return a;
    }

    if (conflictDates.has(a.date)) {
      return a;
    }

    if (
      role === "driver" &&
      !isDriverEligibleForAssignmentDate({
        ambulanceRole: (user as any).ambulanceRole,
        pscheinExpiry: (user as any).pscheinExpiry,
        pscheinConfirmedAt: (user as any).pscheinConfirmedAt,
        assignmentDateISO: a.date,
      })
    ) {
      return a;
    }

    updatedCount += 1;
    return {
      ...a,
      [role]: new mongoose.Types.ObjectId(userId),
    } as any;
  });

  if (updatedCount === 0) {
    const onlySickBlocks =
      skippedBreakdown.sick > 0 &&
      skippedBreakdown.vacation === 0 &&
      skippedBreakdown.both === 0;

    throw new DienstAssignmentError(
      409,
      onlySickBlocks ? "no_assignable_days_sick" : "no_assignable_days",
      onlySickBlocks
        ? "No se pudo asignar ningún día por baja médica."
        : "No se pudo asignar ningún día (vacaciones u otros filtros).",
      { skippedByVacation, skippedBreakdown },
    );
  }

  await dienst.save();

  return {
    message: `Usuario asignado como ${role} a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
    updatedCount,
    skippedByVacation,
    skippedBreakdown,
    dienstId: dienst.id,
    weekStartDate,
    role,
    userId,
  };
}

const toIdString = (v: any): string | undefined =>
  typeof v === "string"
    ? v
    : v && typeof v === "object" && v._id
      ? String(v._id)
      : undefined;

export async function assignTeamToWeek(
  params: {
    dienstNumber: number;
    weekStartDate: string;
    teamId: string;
    resolvedRoles?: { driverId?: string; medicId?: string };
  },
  companyId?: string | null,
): Promise<{
  message: string;
  updatedCount: number;
  skippedByVacation: Array<{ date: string; role: "driver" | "medic" }>;
  dienstId: string;
  weekStartDate: string;
  hints: { driverExpiredButBoth: boolean };
}> {
  const { dienstNumber, weekStartDate, teamId, resolvedRoles } = params;
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!callerCo) {
    throw new DienstAssignmentError(
      403,
      "forbidden",
      "No tienes permiso para modificar este Dienst",
    );
  }

  const team = await Team.findById(teamId)
    .populate("driver", "pscheinExpiry pscheinConfirmedAt ambulanceRole companyId")
    .populate("medic", "pscheinExpiry pscheinConfirmedAt ambulanceRole companyId")
    .lean();

  if (!team) {
    throw new DienstAssignmentError(404, "team_not_found", "Team no encontrado");
  }

  const drv = (team as any).driver;
  const med = (team as any).medic;
  const drvCo = drv?.companyId ? String(drv.companyId) : null;
  const medCo = med?.companyId ? String(med.companyId) : null;
  const companyStr = String(callerCo);
  if (drvCo !== companyStr || medCo !== companyStr) {
    throw new DienstAssignmentError(403, "forbidden", "El equipo no pertenece a tu empresa");
  }

  const teamDriverId = toIdString((team as any).driver);
  const teamMedicId = toIdString((team as any).medic);

  if (!teamDriverId || !teamMedicId) {
    throw new DienstAssignmentError(
      400,
      "invalid_team",
      "Team inválido: faltan driver o medic",
    );
  }

  const teamAmbulanceId: mongoose.Types.ObjectId | null = (team as any).ambulanceId
    ? new mongoose.Types.ObjectId(String((team as any).ambulanceId))
    : null;

  let driverId = teamDriverId;
  let medicId = teamMedicId;

  if (resolvedRoles && (resolvedRoles.driverId || resolvedRoles.medicId)) {
    const rDriverId = resolvedRoles.driverId;
    const rMedicId = resolvedRoles.medicId;

    if (!rDriverId || !rMedicId) {
      throw new DienstAssignmentError(
        400,
        "invalid_resolved_roles",
        "resolvedRoles incompletos: deben incluir driverId y medicId",
      );
    }

    const validIds = new Set([teamDriverId, teamMedicId]);
    if (
      !validIds.has(rDriverId) ||
      !validIds.has(rMedicId) ||
      rDriverId === rMedicId
    ) {
      throw new DienstAssignmentError(
        400,
        "invalid_resolved_roles",
        "resolvedRoles inválidos para este team",
      );
    }

    driverId = rDriverId;
    medicId = rMedicId;
  }

  const rawDriverDoc = (team as any).driver;
  const rawMedicDoc = (team as any).medic;

  const driverDoc =
    rawDriverDoc && toIdString(rawDriverDoc) === driverId
      ? rawDriverDoc
      : rawMedicDoc;
  const medicDoc =
    rawMedicDoc && toIdString(rawMedicDoc) === medicId
      ? rawMedicDoc
      : rawDriverDoc;

  if (!driverDoc || !medicDoc) {
    throw new DienstAssignmentError(
      400,
      "invalid_team",
      "No se pudieron resolver correctamente driverDoc/medicDoc para el team",
    );
  }

  const driverRole = driverDoc?.ambulanceRole as "driver" | "medic" | "both" | undefined;
  const medicRole = medicDoc?.ambulanceRole as "driver" | "medic" | "both" | undefined;

  if (!isAmbulanceRoleValidForSlot(driverRole, "driver")) {
    throw new DienstAssignmentError(
      409,
      "invalid_ambulance_role",
      "El conductor del equipo no tiene rol de ambulancia válido.",
    );
  }
  if (!isAmbulanceRoleValidForSlot(medicRole, "medic")) {
    throw new DienstAssignmentError(
      409,
      "invalid_ambulance_role",
      "El sanitario del equipo no tiene rol de ambulancia válido.",
    );
  }

  const start = new Date(weekStartDate);
  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: {
      $gte: start,
      $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
    },
    companyId: new mongoose.Types.ObjectId(callerCo),
  });

  if (!dienst) {
    throw new DienstAssignmentError(
      404,
      "dienst_not_found",
      "No existe Dienst para esa semana y número",
    );
  }

  const dc = (dienst as any).companyId;
  if (!dc || String(dc) !== String(callerCo)) {
    throw new DienstAssignmentError(403, "forbidden", "No tienes permiso para modificar este Dienst");
  }

  const dates = extractValidDatesFromAssignments(dienst.assignments);

  let driverExpiredButBothHint = false;
  if (dates.length > 0) {
    const nominalDriver = rawDriverDoc as {
      pscheinExpiry?: string;
      pscheinConfirmedAt?: Date;
      ambulanceRole?: string;
    };
    const nominalMedic = rawMedicDoc as {
      pscheinExpiry?: string;
      pscheinConfirmedAt?: Date;
      ambulanceRole?: string;
    };

    for (const d of dates) {
      const nominalBad = !isDriverEligibleForAssignmentDate({
        ambulanceRole: nominalDriver?.ambulanceRole as
          | "driver"
          | "medic"
          | "both"
          | undefined,
        pscheinExpiry: nominalDriver?.pscheinExpiry,
        pscheinConfirmedAt: nominalDriver?.pscheinConfirmedAt,
        assignmentDateISO: d,
      });
      const swapMedicCanDrive =
        nominalDriver?.ambulanceRole === "both" &&
        isDriverEligibleForAssignmentDate({
          ambulanceRole: nominalMedic?.ambulanceRole as
            | "driver"
            | "medic"
            | "both"
            | undefined,
          pscheinExpiry: nominalMedic?.pscheinExpiry,
          pscheinConfirmedAt: nominalMedic?.pscheinConfirmedAt,
          assignmentDateISO: d,
        });
      if (nominalBad && swapMedicCanDrive) {
        driverExpiredButBothHint = true;
      }
    }

    const anyDayResolvedDriverOk = dates.some((d) =>
      isDriverEligibleForAssignmentDate({
        ambulanceRole: driverDoc?.ambulanceRole as
          | "driver"
          | "medic"
          | "both"
          | undefined,
        pscheinExpiry: driverDoc?.pscheinExpiry,
        pscheinConfirmedAt: driverDoc?.pscheinConfirmedAt,
        assignmentDateISO: d,
      }),
    );
    if (!anyDayResolvedDriverOk && !driverExpiredButBothHint) {
      throw new DienstAssignmentError(
        409,
        "pschein_invalid_for_date",
        "El P-Schein del conductor no es válido para ninguna fecha del Dienst.",
      );
    }
  }

  const [driverConf, medicConf] = await Promise.all([
    findWeeklyConflicts(new mongoose.Types.ObjectId(driverId), start, dienstNumber),
    findWeeklyConflicts(new mongoose.Types.ObjectId(medicId), start, dienstNumber),
  ]);

  if ((driverConf?.length ?? 0) > 0 || (medicConf?.length ?? 0) > 0) {
    throw new DienstAssignmentError(
      409,
      "weekly_conflict",
      "Alguno de los miembros ya está asignado a otro Dienst esta semana.",
      { driverConf, medicConf },
    );
  }

  const dayBlockMap = await computeDayBlockMapForTeam({
    driverId,
    medicId,
    dates,
  });

  let updatedCount = 0;
  const skippedByVacation: Array<{ date: string; role: "driver" | "medic" }> = [];

  dienst.assignments = (dienst.assignments || []).map((a) => {
    if (!a?.date || !a?.startTime || !a?.endTime) return a;

    const dateISO = a.date;
    const block = dayBlockMap[dateISO] || { driver: false, medic: false };

    let next = { ...a } as any;
    let changed = false;

    const driverPscheinOk = isDriverEligibleForAssignmentDate({
      ambulanceRole: driverDoc?.ambulanceRole as
        | "driver"
        | "medic"
        | "both"
        | undefined,
      pscheinExpiry: driverDoc?.pscheinExpiry,
      pscheinConfirmedAt: driverDoc?.pscheinConfirmedAt,
      assignmentDateISO: dateISO,
    });
    const cannotAssignDriver = block.driver || !driverPscheinOk;

    if (!cannotAssignDriver) {
      const newId = new mongoose.Types.ObjectId(driverId);
      if (!next.driver || String(next.driver) !== String(newId)) {
        next.driver = newId;
        changed = true;
      }
    } else {
      skippedByVacation.push({ date: dateISO, role: "driver" });
      if (next.driver != null && next.driver !== "") {
        delete next.driver;
        changed = true;
      }
    }

    if (!block.medic) {
      const newId = new mongoose.Types.ObjectId(medicId);
      if (!next.medic || String(next.medic) !== String(newId)) {
        next.medic = newId;
        changed = true;
      }
    } else {
      skippedByVacation.push({ date: dateISO, role: "medic" });
      if (next.medic != null && next.medic !== "") {
        delete next.medic;
        changed = true;
      }
    }

    if (teamAmbulanceId && !next.ambulanceId) {
      next.ambulanceId = teamAmbulanceId;
      changed = true;
    }

    if (changed) updatedCount += 1;
    return next;
  });

  (dienst as any).weekTeamId = new mongoose.Types.ObjectId(teamId);
  await dienst.save();

  return {
    message: `Team asignado a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
    updatedCount,
    skippedByVacation,
    dienstId: dienst.id,
    weekStartDate,
    hints: { driverExpiredButBoth: !!driverExpiredButBothHint },
  };
}

export type MoveSlotSameWeekBody = {
  sourceDienstId: string;
  sourceDate: string;
  targetDienstId: string;
  targetDate: string;
  role: "driver" | "medic";
  userId: string;
};

/**
 * Mueve un usuario entre dos Dienst distintos de la misma semana (origen vacía + destino relleno).
 * Transacción MongoDB: ambos documentos se actualizan o ninguno.
 */
export async function moveSlotSameWeek(
  body: MoveSlotSameWeekBody,
  companyId?: string | null,
): Promise<void> {
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!callerCo) {
    throw new DienstAssignmentError(
      403,
      "forbidden",
      "No tienes permiso para modificar este Dienst",
    );
  }

  const { sourceDienstId, sourceDate, targetDienstId, targetDate, role, userId } = body;

  const srcKey = normalizeDayKey(sourceDate);
  const tgtKey = normalizeDayKey(targetDate);
  if (!srcKey || !tgtKey) {
    throw new DienstAssignmentError(400, "invalid_date", "Fecha inválida.");
  }

  if (sourceDienstId === targetDienstId) {
    throw new DienstAssignmentError(
      400,
      "same_dienst_use_patch",
      "Para mover dentro del mismo Dienst, usa la actualización parcial habitual.",
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const sourceDienst = await Dienst.findById(sourceDienstId).session(session);
      const targetDienst = await Dienst.findById(targetDienstId).session(session);

      if (!sourceDienst || !targetDienst) {
        throw new DienstAssignmentError(404, "dienst_not_found", "Dienst no encontrado.");
      }

      const dcSrc = (sourceDienst as any).companyId;
      const dcTgt = (targetDienst as any).companyId;
      if (!dcSrc || !dcTgt || String(dcSrc) !== callerCo || String(dcTgt) !== callerCo) {
        throw new DienstAssignmentError(
          403,
          "forbidden",
          "No tienes permiso para modificar este Dienst",
        );
      }

      const wSrc = weekStartMondayBerlin((sourceDienst as any).weekStartDate);
      const wTgt = weekStartMondayBerlin((targetDienst as any).weekStartDate);
      if (!wSrc || !wTgt || wSrc !== wTgt) {
        throw new DienstAssignmentError(
          400,
          "cross_week_forbidden",
          "Solo se permiten movimientos dentro de la misma semana.",
        );
      }

      const rawWs = (sourceDienst as any).weekStartDate;
      const weekStartDate =
        rawWs instanceof Date ? rawWs : new Date(rawWs as string);
      if (Number.isNaN(weekStartDate.getTime())) {
        throw new DienstAssignmentError(400, "invalid_week", "Semana inválida en el Dienst.");
      }

      const sourceIdx = sourceDienst.assignments.findIndex(
        (a: any) => a?.date && normalizeDayKey(a.date) === srcKey,
      );
      const targetIdx = targetDienst.assignments.findIndex(
        (a: any) => a?.date && normalizeDayKey(a.date) === tgtKey,
      );

      if (sourceIdx === -1 || targetIdx === -1) {
        throw new DienstAssignmentError(
          404,
          "assignment_not_found",
          "No se encontró la asignación para la fecha indicada.",
        );
      }

      const sourceAssignment = sourceDienst.assignments[sourceIdx] as any;
      const targetAssignment = targetDienst.assignments[targetIdx] as any;

      if (
        !String(sourceAssignment?.startTime ?? "").trim() ||
        !String(sourceAssignment?.endTime ?? "").trim() ||
        !String(targetAssignment?.startTime ?? "").trim() ||
        !String(targetAssignment?.endTime ?? "").trim()
      ) {
        throw new DienstAssignmentError(
          400,
          "assignment_incomplete",
          "Faltan horas o fechas en la asignación.",
        );
      }

      const sourceUserId =
        role === "driver" ? oidStr(sourceAssignment.driver) : oidStr(sourceAssignment.medic);
      if (!sourceUserId || sourceUserId !== String(userId).trim()) {
        throw new DienstAssignmentError(
          409,
          "source_slot_mismatch",
          "El usuario no coincide con el slot de origen.",
        );
      }

      const targetOccupied =
        role === "driver" ? oidStr(targetAssignment.driver) : oidStr(targetAssignment.medic);
      if (targetOccupied) {
        throw new DienstAssignmentError(
          409,
          "target_slot_not_empty",
          "El destino debe estar vacío.",
        );
      }

      const userOid = new mongoose.Types.ObjectId(userId);

      const weeklyConf = await findWeeklyConflicts(
        userOid,
        weekStartDate,
        (targetDienst as any).dienstNumber,
      );
      const filteredConf = weeklyConf.filter(
        (c) =>
          !(
            c.dienstId === String(sourceDienstId) &&
            normalizeDayKey(c.date) === srcKey &&
            c.role === role
          ),
      );
      if (filteredConf.some((c) => normalizeDayKey(c.date) === tgtKey)) {
        throw new DienstAssignmentError(
          409,
          "weekly_conflict",
          "El usuario ya está asignado en otro Dienst ese día.",
        );
      }

      const [vac, sick] = await Promise.all([
        isOnVacationDay({ userId, dateISO: tgtKey }),
        isOnSickDay({ userId, dateISO: tgtKey }),
      ]);
      if (vac || sick) {
        throw new DienstAssignmentError(
          409,
          "target_day_blocked",
          "El usuario no está disponible ese día (vacaciones o baja).",
        );
      }

      const sd = oidStr(sourceAssignment.driver);
      const sm = oidStr(sourceAssignment.medic);
      const td = oidStr(targetAssignment.driver);
      const tm = oidStr(targetAssignment.medic);

      let sourceRow: Record<string, unknown>;
      let targetRow: Record<string, unknown>;

      if (role === "driver") {
        sourceRow = {
          date: sourceAssignment.date,
          startTime: sourceAssignment.startTime,
          endTime: sourceAssignment.endTime,
          driver: "",
          medic: sm || undefined,
        };
        targetRow = {
          date: targetAssignment.date,
          startTime: targetAssignment.startTime,
          endTime: targetAssignment.endTime,
          driver: userId,
          medic: tm || undefined,
        };
      } else {
        sourceRow = {
          date: sourceAssignment.date,
          startTime: sourceAssignment.startTime,
          endTime: sourceAssignment.endTime,
          driver: sd || undefined,
          medic: "",
        };
        targetRow = {
          date: targetAssignment.date,
          startTime: targetAssignment.startTime,
          endTime: targetAssignment.endTime,
          driver: td || undefined,
          medic: userId,
        };
      }

      await validateAssignmentEntities([sourceRow, targetRow] as any[], String(callerCo));

      const srcA = sourceDienst.assignments[sourceIdx] as any;
      const tgtA = targetDienst.assignments[targetIdx] as any;

      if (role === "driver") {
        srcA.driver = undefined;
        if ("driver" in srcA) delete srcA.driver;
        tgtA.driver = new mongoose.Types.ObjectId(userId);
      } else {
        srcA.medic = undefined;
        if ("medic" in srcA) delete srcA.medic;
        tgtA.medic = new mongoose.Types.ObjectId(userId);
      }

      await sourceDienst.save({ session });
      await targetDienst.save({ session });
    });
  } finally {
    await session.endSession();
  }
}
