import mongoose from "mongoose";
import { DateTime } from "luxon";
import Dienst from "../../models/dienst.model";
import User from "../../../users/models/user.model";
import { Team } from "../../../teams";
import { Ambulance } from "../../../ambulances";
import type { AssignedDay } from "../../types/dienst.types";
import {
  findWeeklyConflicts,
  findAmbulanceTimeConflicts,
  formatAmbulanceConflictMessage,
  isAmbulanceRoleValidForSlot,
  isDriverEligibleForAssignmentDate,
  isOnVacationDay,
  isOnSickDay,
  computeTeamDayAbsenceData,
} from "../../utils/dienstValidation";
import { extractValidDatesFromAssignments, mapAssignmentToAssignedDay } from "../../utils/dienstMappers";
import { entitiesBelongToSameCompany } from "../../../../utils/requireCompany";
import {
  sendPushNotification,
  voidEmitSchedulingMutationRealtime,
} from "../../../notifications";
import { companyHasEnabledModule } from "../../../../utils/companyEnabledModules";
import { MODULE_KEYS } from "../../../companies/constants/modules.constants";
import { computeShiftBounds, diffMinutes, getWeekMongoDateRange, ZONE } from "../../../../utils/time";
import { DienstAssignmentError } from "./assignment-errors";
import type { DndCrossDienstSameWeekBody } from "../schemas/dnd-cross-dienst-same-week.schema";

const BERLIN = "Europe/Berlin";

/** Descanso mínimo duro (batch 1): menos de esto => bloqueo en updateDienstPartial. */
const MIN_REST_MINUTES_HARD = 600;
/** Límite superior del aviso (batch 2): desde 10h hasta < 11h => éxito con aviso. */
const MIN_REST_MINUTES_SOFT_MAX = 660;

type RestShiftInterval = {
  dienstId: string;
  date: string;
  userId: string;
  start: DateTime;
  end: DateTime;
};

function flattenAssignmentsToRestShifts(
  dienstDoc: { _id?: unknown; assignments?: unknown[] },
  dienstIdStr: string,
): RestShiftInterval[] {
  const out: RestShiftInterval[] = [];
  for (const a of dienstDoc.assignments ?? []) {
    const row = a as {
      date?: string;
      startTime?: string;
      endTime?: string;
      driver?: unknown;
      medic?: unknown;
    };
    if (!row?.date || !row?.startTime || !row?.endTime) continue;
    const dateKey = normalizeDayKey(row.date);
    if (!dateKey) continue;
    const { start, end } = computeShiftBounds(dateKey, row.startTime, row.endTime);
    const drv = oidStr(row.driver);
    const med = oidStr(row.medic);
    if (drv) {
      out.push({ dienstId: dienstIdStr, date: dateKey, userId: drv, start, end });
    }
    if (med) {
      out.push({ dienstId: dienstIdStr, date: dateKey, userId: med, start, end });
    }
  }
  return out;
}

/** Comparación estable de ids de usuario (string / ObjectId) para vecinos de descanso. */
function sameUserIdString(a: string, b: string): boolean {
  const sa = String(a).trim();
  const sb = String(b).trim();
  if (sa === sb) return true;
  if (!mongoose.Types.ObjectId.isValid(sa) || !mongoose.Types.ObjectId.isValid(sb)) {
    return sa.toLowerCase() === sb.toLowerCase();
  }
  return String(new mongoose.Types.ObjectId(sa)) === String(new mongoose.Types.ObjectId(sb));
}

/**
 * Vecinos cronológicos para un turno propuesto: último fin estrictamente antes del inicio,
 * primer inicio estrictamente después del fin (Europe/Berlin, soporta cruces de medianoche).
 */
function findNeighborRestShifts(
  shifts: RestShiftInterval[],
  userId: string,
  proposed: { start: DateTime; end: DateTime },
  exclude: { dienstId: string; date: string; userId: string },
): { prev: RestShiftInterval | null; next: RestShiftInterval | null } {
  const sameUser = shifts.filter((s) => sameUserIdString(s.userId, userId));
  const without = sameUser.filter(
    (s) =>
      !(
        s.dienstId === exclude.dienstId &&
        s.date === exclude.date &&
        sameUserIdString(s.userId, exclude.userId)
      ),
  );
  const before = without.filter((s) => s.end < proposed.start);
  const prev = before.length
    ? before.reduce((a, b) => (a.end > b.end ? a : b))
    : null;
  const after = without.filter((s) => s.start > proposed.end);
  const next = after.length
    ? after.reduce((a, b) => (a.start < b.start ? a : b))
    : null;
  return { prev, next };
}

/**
 * Lunes 00:00 de la semana ISO en Europe/Berlin (Luxon weekday 1 = lunes).
 * Evita startOf("week"), que depende del locale del sistema.
 */
function isoWeekMondayStartBerlin(dt: DateTime): DateTime {
  const d = dt.setZone(ZONE).startOf("day");
  return d.minus({ days: d.weekday - 1 }).startOf("day");
}

/**
 * Carga Dienst de la empresa en ventana de semanas alrededor de las fechas dadas (límites de semana).
 */
async function fetchDienstDocsForRestWindow(
  companyId: string,
  minDateISO: string,
  maxDateISO: string,
): Promise<Array<{ _id: unknown; assignments?: unknown[] }>> {
  const min = DateTime.fromISO(minDateISO, { zone: ZONE }).startOf("day");
  const max = DateTime.fromISO(maxDateISO, { zone: ZONE }).startOf("day");
  if (!min.isValid || !max.isValid) return [];

  const mondayMin = isoWeekMondayStartBerlin(min);
  const mondayMax = isoWeekMondayStartBerlin(max);
  const rangeStart = mondayMin.minus({ days: 7 }).startOf("day");
  const rangeEnd = mondayMax.plus({ days: 7 }).endOf("day");

  return Dienst.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    weekStartDate: { $gte: rangeStart.toJSDate(), $lte: rangeEnd.toJSDate() },
  })
    .select("assignments weekStartDate")
    .lean();
}

export type MinimumRestWarningPayload = {
  code: "minimum_rest_soft";
  message: string;
};

/**
 * Mínimo descanso entre turnos sobre uno o varios Dienst ya fusionados en memoria.
 * companyId acota la consulta de vecinos; cada snapshot sustituye assignments del doc cargado.
 */
async function runMinimumRestChecksForMergedDienstStates(
  companyId: string,
  dienstSnapshots: Array<{ id: string; mergedAssignments: unknown[] }>,
  rowsToCheck: Array<{ dienstId: string; date: string }>,
  options?: {
    restrictUserId?: string;
    /** Si se indica con restrictUserId, solo valida ese rol en la fila (assignUserToWeek). */
    restrictRole?: "driver" | "medic";
  },
): Promise<{ minimumRestWarning?: MinimumRestWarningPayload }> {
  const rowDateKeys = rowsToCheck
    .map((r) => normalizeDayKey(r.date))
    .filter((r) => r !== "");
  const sorted = [...new Set(rowDateKeys)].sort();
  if (sorted.length === 0) return {};

  let minimumRestWarning: MinimumRestWarningPayload | undefined;

  const minD = sorted[0]!;
  const maxD = sorted[sorted.length - 1]!;

  const fetched = await fetchDienstDocsForRestWindow(companyId, minD, maxD);

  const docs: Array<{ _id: unknown; assignments?: unknown[] }> = fetched.map((d) => {
    const snap = dienstSnapshots.find((s) => String(s.id) === String(d._id));
    return snap ? { ...d, assignments: snap.mergedAssignments } : d;
  });
  for (const snap of dienstSnapshots) {
    if (!docs.some((d) => String(d._id) === String(snap.id))) {
      docs.push({
        _id: new mongoose.Types.ObjectId(String(snap.id)),
        assignments: snap.mergedAssignments,
      });
    }
  }

  const allShifts: RestShiftInterval[] = [];
  for (const d of docs) {
    allShifts.push(...flattenAssignmentsToRestShifts(d, String(d._id)));
  }

  for (const { dienstId, date } of rowsToCheck) {
    const dk = normalizeDayKey(date);
    if (!dk) continue;
    const snap = dienstSnapshots.find((s) => String(s.id) === String(dienstId));
    const row = (snap?.mergedAssignments ?? []).find(
      (a: any) => normalizeDayKey(a?.date) === dk,
    ) as {
      date?: string;
      startTime?: string;
      endTime?: string;
      driver?: unknown;
      medic?: unknown;
    } | undefined;
    if (!row) {
      throw new DienstAssignmentError(
        500,
        "internal_rest_row_not_found",
        `Fila no encontrada para descanso mínimo (dienstId=${dienstId}, date=${date}).`,
      );
    }
    if (!row.startTime || !row.endTime) continue;

    const dateKey = normalizeDayKey(row.date ?? dk);
    if (!dateKey) continue;
    const proposed = computeShiftBounds(dateKey, row.startTime, row.endTime);

    const roles: Array<{ uid: string }> = [];
    const dId = oidStr(row.driver);
    const mId = oidStr(row.medic);
    if (dId) roles.push({ uid: dId });
    if (mId) roles.push({ uid: mId });

    const restrict = options?.restrictUserId?.trim();
    const onlyRole = options?.restrictRole;
    let rolesToValidate: Array<{ uid: string }>;
    if (
      restrict &&
      restrict !== "" &&
      (onlyRole === "driver" || onlyRole === "medic")
    ) {
      const slotId = onlyRole === "driver" ? dId : mId;
      rolesToValidate = slotId ? [{ uid: slotId }] : [];
      if (rolesToValidate.length === 0) {
        rolesToValidate = roles;
      }
    } else if (restrict && restrict !== "") {
      rolesToValidate = [];
      if (dId && sameUserIdString(dId, restrict)) rolesToValidate.push({ uid: dId });
      if (mId && sameUserIdString(mId, restrict)) rolesToValidate.push({ uid: mId });
      if (rolesToValidate.length === 0) {
        rolesToValidate = roles;
      }
    } else {
      rolesToValidate = roles;
    }

    for (const { uid } of rolesToValidate) {
      const { prev, next } = findNeighborRestShifts(allShifts, uid, proposed, {
        dienstId: String(dienstId),
        date: dateKey,
        userId: uid,
      });
      const gapPrev = prev ? diffMinutes(prev.end, proposed.start) : null;
      const gapNext = next ? diffMinutes(proposed.end, next.start) : null;

      if (gapPrev !== null && gapPrev < MIN_REST_MINUTES_HARD) {
        throw new DienstAssignmentError(
          409,
          "insufficient_rest",
          "Descanso insuficiente entre turnos (menos de 10 horas).",
        );
      }
      if (gapNext !== null && gapNext < MIN_REST_MINUTES_HARD) {
        throw new DienstAssignmentError(
          409,
          "insufficient_rest",
          "Descanso insuficiente entre turnos (menos de 10 horas).",
        );
      }
      if (
        gapPrev !== null &&
        gapPrev >= MIN_REST_MINUTES_HARD &&
        gapPrev < MIN_REST_MINUTES_SOFT_MAX
      ) {
        minimumRestWarning = {
          code: "minimum_rest_soft",
          message:
            "Descanso entre turnos entre 10 y 11 horas (revisar si el intervalo es aceptable).",
        };
      }
      if (
        gapNext !== null &&
        gapNext >= MIN_REST_MINUTES_HARD &&
        gapNext < MIN_REST_MINUTES_SOFT_MAX
      ) {
        minimumRestWarning = {
          code: "minimum_rest_soft",
          message:
            "Descanso entre turnos entre 10 y 11 horas (revisar si el intervalo es aceptable).",
        };
      }
    }
  }
  return { minimumRestWarning };
}

/**
 * Mínimo descanso (updateDienstPartial): <10h bloqueo; 10h–<11h aviso; ≥11h ok.
 */
async function runMinimumRestChecksForPartialUpdate(
  currentDienstId: string,
  incomingRows: any[],
  mergedDienst: { assignments?: unknown[]; toObject?: () => unknown },
  companyId: string,
): Promise<{ minimumRestWarning?: MinimumRestWarningPayload }> {
  const mergedPlain = mergedDienst.toObject
    ? (mergedDienst.toObject() as { assignments?: unknown[] })
    : { assignments: mergedDienst.assignments };

  const rowsToCheck = incomingRows
    .map((inc) => ({
      dienstId: currentDienstId,
      date: typeof inc?.date === "string" ? inc.date : "",
    }))
    .filter((r) => normalizeDayKey(r.date) !== "");

  return runMinimumRestChecksForMergedDienstStates(
    companyId,
    [{ id: currentDienstId, mergedAssignments: mergedPlain.assignments ?? [] }],
    rowsToCheck,
  );
}

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

  const dienst = await Dienst.findById(dienstId).select("companyId assignments").lean();
  if (!dienst) return null;

  const dc = (dienst as any).companyId;
  if (!dc) return null;
  if (String(dc) !== callerCo) return null;

  const matchingSlot = (dienst as any).assignments?.find((a: any) => a.date === date);
  const removedIds: string[] = [];
  if (matchingSlot) {
    const dId = oidStr(matchingSlot.driver);
    const mId = oidStr(matchingSlot.medic);
    if (dId) removedIds.push(dId);
    if (mId && mId !== dId) removedIds.push(mId);
  }

  const updated = await Dienst.findByIdAndUpdate(
    dienstId,
    { $pull: { assignments: { date } } },
    { new: true },
  )
    .populate("assignments.driver", "name lastName pscheinExpiry")
    .populate("assignments.medic", "name lastName pscheinExpiry")
    .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate");

  if (updated && removedIds.length > 0) {
    void sendPushNotification(
      removedIds,
      "Asignación eliminada",
      `Tu asignación del ${date} ha sido eliminada.`,
      { screen: "agenda", date },
    );
    voidEmitSchedulingMutationRealtime(callerCo, removedIds);
  } else if (updated) {
    voidEmitSchedulingMutationRealtime(callerCo, []);
  }

  return updated;
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

  const { start: weekStart, end: weekEnd } = getWeekMongoDateRange(weekStartDate);

  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: { $gte: weekStart, $lte: weekEnd },
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

  const clearedUserIds = new Set<string>();
  for (const a of dienst.assignments) {
    const dId = oidStr((a as any).driver);
    const mId = oidStr((a as any).medic);
    if (dId) clearedUserIds.add(dId);
    if (mId) clearedUserIds.add(mId);
  }

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

  if (clearedUserIds.size > 0) {
    void sendPushNotification(
      [...clearedUserIds],
      "Asignaciones eliminadas",
      `Tus asignaciones del Dienst #${dienstNumber} (semana del ${weekStartDate}) han sido eliminadas.`,
      { screen: "agenda", date: weekStartDate },
    );
  }
  voidEmitSchedulingMutationRealtime(callerCo, clearedUserIds);

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

/**
 * Reglas de planificación (misma semana / otro Dienst, vacaciones, baja) al asignar
 * a alguien a un slot que antes no tenía ese ocupante. Alineado con moveSlotSameWeek
 * (sin exclusión de slot origen: aquí solo aplica PATCH a un único Dienst).
 */
async function validateSchedulingForNewSlotOccupant(params: {
  userId: string;
  dateRaw: string;
  weekStartDate: Date;
  dienstNumber: number;
  companyId: string;
}): Promise<void> {
  const { userId, dateRaw, weekStartDate, dienstNumber, companyId } = params;
  const tgtKey = normalizeDayKey(dateRaw);
  if (!tgtKey) {
    throw new DienstAssignmentError(400, "invalid_date", "Fecha inválida.");
  }

  const userOid = new mongoose.Types.ObjectId(userId);

  const weeklyConf = await findWeeklyConflicts(
    userOid,
    weekStartDate,
    companyId,
    dienstNumber,
  );
  if (weeklyConf.some((c) => normalizeDayKey(c.date) === tgtKey)) {
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
}

export async function updateDienstPartial(
  dienstId: string,
  assignments: any[],
  companyId?: string | null,
): Promise<
  | {
      dienst: mongoose.Document;
      minimumRestWarning?: MinimumRestWarningPayload;
    }
  | null
> {
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

  const ambulancesModuleEnabled =
    await companyHasEnabledModule(dienstCompanyId, MODULE_KEYS.AMBULANCES);
  if (!ambulancesModuleEnabled) {
    for (const incoming of assignments) {
      if (!Object.prototype.hasOwnProperty.call(incoming, "ambulanceId")) continue;
      const incomingAny = incoming as { date?: string; ambulanceId?: unknown };
      const isClearing =
        incomingAny.ambulanceId === "" || incomingAny.ambulanceId === null;
      if (isClearing) continue;

      const newAmbId = oidStr(incomingAny.ambulanceId);
      if (!newAmbId) continue;

      const idx = dienst.assignments.findIndex(
        (a: { date?: string }) => a.date === incomingAny.date,
      );
      const prev = idx !== -1 ? dienst.assignments[idx] : null;
      const oldAmbId = oidStr(prev?.ambulanceId);

      if (newAmbId !== oldAmbId) {
        throw new DienstAssignmentError(
          403,
          "ambulances_module_disabled",
          "El módulo de ambulancias no está habilitado para esta empresa.",
        );
      }
    }
  }

  await validateAssignmentEntities(assignments, dienstCompanyId);

  let cachedWeekStart: Date | null = null;
  const weekStartForScheduling = (): Date => {
    if (cachedWeekStart) return cachedWeekStart;
    const rawWs = (dienst as any).weekStartDate;
    const d = rawWs instanceof Date ? rawWs : new Date(rawWs as string);
    if (Number.isNaN(d.getTime())) {
      throw new DienstAssignmentError(
        400,
        "invalid_week",
        "Semana inválida en el Dienst.",
      );
    }
    cachedWeekStart = d;
    return d;
  };

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
    const prev = idx !== -1 ? dienst.assignments[idx] : null;

    if (Object.prototype.hasOwnProperty.call(incoming, "driver")) {
      const newId = oidStr(updatedCopy.driver);
      const oldId = oidStr(prev?.driver);
      if (newId && newId !== oldId) {
        await validateSchedulingForNewSlotOccupant({
          userId: newId,
          dateRaw: updatedCopy.date,
          weekStartDate: weekStartForScheduling(),
          dienstNumber: (dienst as any).dienstNumber,
          companyId: dienstCompanyId,
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "medic")) {
      const newId = oidStr(updatedCopy.medic);
      const oldId = oidStr(prev?.medic);
      if (newId && newId !== oldId) {
        await validateSchedulingForNewSlotOccupant({
          userId: newId,
          dateRaw: updatedCopy.date,
          weekStartDate: weekStartForScheduling(),
          dienstNumber: (dienst as any).dienstNumber,
          companyId: dienstCompanyId,
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "ambulanceId")) {
      const newAmbId = oidStr((incoming as any).ambulanceId);
      const oldAmbId = oidStr(prev?.ambulanceId);
      if (
        newAmbId &&
        mongoose.Types.ObjectId.isValid(newAmbId) &&
        newAmbId !== oldAmbId
      ) {
        const ambConflicts = await findAmbulanceTimeConflicts({
          ambulanceId: new mongoose.Types.ObjectId(newAmbId),
          currentDienstId: new mongoose.Types.ObjectId(dienstId),
          assignments: [
            {
              date: updatedCopy.date,
              startTime: updatedCopy.startTime,
              endTime: updatedCopy.endTime,
            },
          ],
          companyId: callerCo,
        });
        if (ambConflicts.length > 0) {
          throw new DienstAssignmentError(
            409,
            "ambulance_time_conflict",
            formatAmbulanceConflictMessage(ambConflicts[0]!),
            ambConflicts,
          );
        }
      }
    }
  }

  const addedUserIds = new Set<string>();
  const removedUserIds = new Set<string>();
  const scheduleChangedUserIds = new Set<string>();
  const ambulanceChangedUserIds = new Set<string>();

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
      const oldDriverId = oidStr((prev as any).driver);
      const oldMedicId = oidStr((prev as any).medic);
      const oldStartTime = (prev as any).startTime;
      const oldEndTime = (prev as any).endTime;

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
        const newDriverId = oidStr((prev as any).driver);
        if (newDriverId && newDriverId !== oldDriverId) addedUserIds.add(newDriverId);
        if (oldDriverId && newDriverId !== oldDriverId) removedUserIds.add(oldDriverId);
      }

      if (hasMedicField) {
        const incomingMedic = (incoming as any).medic;
        if (incomingMedic === "" || incomingMedic === null) {
          (prev as any).medic = null;
          if ("medic" in prev) delete (prev as any).medic;
        } else {
          prev.medic = updatedCopy.medic;
        }
        const newMedicId = oidStr((prev as any).medic);
        if (newMedicId && newMedicId !== oldMedicId) addedUserIds.add(newMedicId);
        if (oldMedicId && newMedicId !== oldMedicId) removedUserIds.add(oldMedicId);
      }

      if (hasAmbulanceField) {
        const amb = (incoming as any).ambulanceId;
        const oldAmbId = oidStr((prev as any).ambulanceId);
        if (amb === "" || amb === null) {
          (prev as any).ambulanceId = null;
          if ("ambulanceId" in prev) delete (prev as any).ambulanceId;
        } else if (amb !== undefined) {
          (prev as any).ambulanceId = amb;
        }
        const newAmbId = oidStr((prev as any).ambulanceId);
        if (newAmbId !== oldAmbId) {
          const slotDriver = oidStr((prev as any).driver);
          const slotMedic = oidStr((prev as any).medic);
          if (slotDriver) ambulanceChangedUserIds.add(slotDriver);
          if (slotMedic) ambulanceChangedUserIds.add(slotMedic);
        }
      }

      dienst.assignments[idx] = prev as any;

      // Notify workers whose schedule changed but who aren't being newly assigned
      const timeChanged =
        updatedCopy.startTime !== oldStartTime || updatedCopy.endTime !== oldEndTime;
      if (timeChanged) {
        const stillDriver = oidStr((prev as any).driver);
        const stillMedic = oidStr((prev as any).medic);
        if (stillDriver) scheduleChangedUserIds.add(stillDriver);
        if (stillMedic) scheduleChangedUserIds.add(stillMedic);
      }
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
      const pushedDriverId = oidStr(toInsert.driver);
      const pushedMedicId = oidStr(toInsert.medic);
      if (pushedDriverId) addedUserIds.add(pushedDriverId);
      if (pushedMedicId) addedUserIds.add(pushedMedicId);
    }
  }

  const restMeta = await runMinimumRestChecksForPartialUpdate(
    String(dienst._id),
    assignments,
    dienst,
    callerCo,
  );

  await dienst.save();

  const dienstNum = (dienst as any).dienstNumber as number;
  const rawWs = (dienst as any).weekStartDate;
  const dienstWeekDate: string =
    rawWs instanceof Date
      ? rawWs.toISOString().slice(0, 10)
      : typeof rawWs === "string"
        ? rawWs.slice(0, 10)
        : "";

  if (addedUserIds.size > 0) {
    void sendPushNotification(
      [...addedUserIds],
      "Nueva asignación de turno",
      `Has sido asignado al Dienst #${dienstNum}.`,
      { screen: "agenda", date: dienstWeekDate },
    );
  }
  const trulyRemoved = [...removedUserIds].filter((id) => !addedUserIds.has(id));
  if (trulyRemoved.length > 0) {
    void sendPushNotification(
      trulyRemoved,
      "Asignación eliminada",
      `Tu asignación al Dienst #${dienstNum} ha sido eliminada.`,
      { screen: "agenda", date: dienstWeekDate },
    );
  }
  const scheduleChangedOnly = [...scheduleChangedUserIds].filter(
    (id) => !addedUserIds.has(id),
  );
  if (scheduleChangedOnly.length > 0) {
    void sendPushNotification(
      scheduleChangedOnly,
      "Horario modificado",
      `El horario de tu turno en el Dienst #${dienstNum} ha sido modificado.`,
      { screen: "agenda", date: dienstWeekDate },
    );
  }
  const ambulanceChangedOnly = [...ambulanceChangedUserIds].filter(
    (id) => !addedUserIds.has(id),
  );
  if (ambulanceChangedOnly.length > 0) {
    void sendPushNotification(
      ambulanceChangedOnly,
      "Ambulancia asignada",
      `La ambulancia de tu turno en el Dienst #${dienstNum} ha sido actualizada.`,
      { screen: "agenda", date: dienstWeekDate },
    );
  }

  const agendaWorkerIds = new Set<string>([
    ...addedUserIds,
    ...removedUserIds,
    ...scheduleChangedUserIds,
    ...ambulanceChangedUserIds,
  ]);
  voidEmitSchedulingMutationRealtime(callerCo, agendaWorkerIds);

  const populated = await Dienst.findById(dienstId)
    .populate("assignments.driver", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.medic", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate");

  if (!populated) return null;

  return {
    dienst: populated,
    ...(restMeta.minimumRestWarning
      ? { minimumRestWarning: restMeta.minimumRestWarning }
      : {}),
  };
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
  /** Fechas (yyyy-MM-dd) omitidas por descanso mínimo &lt; 10 h (solo assignUserToWeek). */
  skippedByMinimumRest: string[];
  dienstId: string;
  weekStartDate: string;
  role: string;
  userId: string;
  minimumRestWarning?: MinimumRestWarningPayload;
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

  const { start: weekStart, end: weekEnd } = getWeekMongoDateRange(weekStartDate);

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
    weekStart,
    callerCo,
    dienstNumber,
  );
  const conflictDates = new Set(weeklyConf.map((c) => c.date));

  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: { $gte: weekStart, $lte: weekEnd },
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

  const skippedByVacation: string[] = [];
  const skippedBreakdown = { sick: 0, vacation: 0, both: 0 };

  const eligible: Array<{ idx: number; dateKey: string }> = [];

  for (let idx = 0; idx < dienst.assignments.length; idx++) {
    const a = dienst.assignments[idx] as any;
    if (!a?.date || !a?.startTime || !a?.endTime) continue;

    const isVac = !!vacationMap[a.date];
    const isSick = !!sickMap[a.date];

    if (isVac || isSick) {
      skippedByVacation.push(a.date);
      if (isVac && isSick) skippedBreakdown.both += 1;
      else if (isSick) skippedBreakdown.sick += 1;
      else if (isVac) skippedBreakdown.vacation += 1;
      continue;
    }

    if (conflictDates.has(a.date)) {
      continue;
    }

    const oppositeRole = role === "driver" ? "medic" : "driver";
    const oppositeId = (a as any)[oppositeRole]?.toString?.();
    if (oppositeId && oppositeId === userId) {
      continue;
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
      continue;
    }

    const dk = normalizeDayKey(a.date);
    if (dk) eligible.push({ idx, dateKey: dk });
  }

  eligible.sort((x, y) => x.dateKey.localeCompare(y.dateKey));

  if (eligible.length === 0) {
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

  let working = dienst.assignments.map((a) => {
    // Subdocumentos Mongoose: el spread puede omitir driver/medic/date; toObject() materializa campos.
    const src = ((a as any)?.toObject?.() ?? a) as any;
    const copy = { ...src };
    const rawDate = src?.date;
    if (rawDate != null) {
      const dk = normalizeDayKey(String(rawDate));
      if (dk) copy.date = dk;
    }
    return copy;
  });
  const skippedByMinimumRest: string[] = [];
  let minimumRestWarning: MinimumRestWarningPayload | undefined;
  const uidNorm = String(userId).trim();
  const userOid = new mongoose.Types.ObjectId(userId);
  let assignedCount = 0;

  for (const { idx, dateKey } of eligible) {
    const row = working[idx] as any;
    const nextRow = {
      ...row,
      date: dateKey,
      [role]: userOid,
    } as any;

    const mergedAssignments = working.map((x, j) =>
      j === idx ? nextRow : x,
    );

    try {
      const rr = await runMinimumRestChecksForMergedDienstStates(
        callerCo,
        [
          {
            id: String(dienst._id),
            mergedAssignments: mergedAssignments as unknown[],
          },
        ],
        [{ dienstId: String(dienst._id), date: dateKey }],
        { restrictUserId: uidNorm, restrictRole: role },
      );
      working = mergedAssignments;
      assignedCount += 1;
      if (rr.minimumRestWarning) minimumRestWarning = rr.minimumRestWarning;
    } catch (e: unknown) {
      const errCode =
        e instanceof DienstAssignmentError
          ? e.code
          : typeof e === "object" &&
              e !== null &&
              "code" in e &&
              typeof (e as { code?: unknown }).code === "string"
            ? (e as { code: string }).code
            : "";
      if (errCode === "insufficient_rest") {
        skippedByMinimumRest.push(dateKey);
        continue;
      }
      throw e;
    }
  }

  if (assignedCount === 0) {
    throw new DienstAssignmentError(
      409,
      "no_assignable_days_minimum_rest",
      "No se pudo asignar ningún día por descanso mínimo entre turnos.",
      {
        skippedByVacation,
        skippedBreakdown,
        skippedByMinimumRest,
      },
    );
  }

  dienst.assignments = working as any;

  await dienst.save();

  void sendPushNotification(
    [userId],
    "Nueva asignación de turno",
    `Has sido asignado como ${role} a ${assignedCount} día(s) del Dienst #${dienstNumber}.`,
    { screen: "agenda", date: weekStartDate },
  );
  voidEmitSchedulingMutationRealtime(callerCo, [userId]);

  const partialMinRest = skippedByMinimumRest.length > 0;
  const message = partialMinRest
    ? `Usuario asignado como ${role} a ${assignedCount} día(s); omitido(s) ${skippedByMinimumRest.length} por descanso mínimo (${skippedByMinimumRest.join(", ")}).`
    : `Usuario asignado como ${role} a ${assignedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`;

  return {
    message,
    updatedCount: assignedCount,
    skippedByVacation,
    skippedBreakdown,
    skippedByMinimumRest,
    dienstId: dienst.id,
    weekStartDate,
    role,
    userId,
    ...(minimumRestWarning ? { minimumRestWarning } : {}),
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
  /** Fechas (yyyy-MM-dd) con conflicto de otra guardia en la misma semana (miembro ya asignado en otro Dienst). */
  skippedByWeeklyConflict: string[];
  /** Fechas (yyyy-MM-dd) donde no se pudo colocar ningún rol del team por descanso mínimo (habiendo rol elegible). */
  skippedByMinimumRest: string[];
  /**
   * Descanso mínimo por rol cuando otro rol sí quedó asignado (p. ej. solo conductor y el sanitario no pasa el check).
   * No sustituye a {@link skippedByMinimumRest} para días totalmente sin asignación.
   */
  skippedByMinimumRestRoles: Array<{ date: string; role: "driver" | "medic" }>;
  /** Ausencias con motivo real (vacaciones vs baja) por fecha y rol. */
  skippedAbsences: Array<{
    date: string;
    role: "driver" | "medic";
    reason: "vacation" | "sick";
  }>;
  /** Fechas (yyyy-MM-dd) con conductor y sanitario del team asignados. */
  daysAssignedFull: string[];
  /** Fechas (yyyy-MM-dd) solo con conductor del team. */
  daysAssignedDriverOnly: string[];
  /** Fechas (yyyy-MM-dd) solo con sanitario del team. */
  daysAssignedMedicOnly: string[];
  dienstId: string;
  weekStartDate: string;
  hints: { driverExpiredButBoth: boolean };
  minimumRestWarning?: MinimumRestWarningPayload;
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

  const team = await Team.findOne({
    _id: teamId,
    companyId: new mongoose.Types.ObjectId(callerCo),
  })
    .populate("driver", "pscheinExpiry pscheinConfirmedAt ambulanceRole companyId")
    .populate("medic", "pscheinExpiry pscheinConfirmedAt ambulanceRole companyId")
    .lean();

  if (!team) {
    throw new DienstAssignmentError(404, "team_not_found", "Team no encontrado");
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

  if (
    teamAmbulanceId &&
    !(await companyHasEnabledModule(callerCo, MODULE_KEYS.AMBULANCES))
  ) {
    throw new DienstAssignmentError(
      403,
      "ambulances_module_disabled",
      "El módulo de ambulancias no está habilitado: el equipo tiene una ambulancia asignada. Quítala del equipo o activa el módulo.",
    );
  }

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

  const { start: weekStart, end: weekEnd } = getWeekMongoDateRange(weekStartDate);
  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: { $gte: weekStart, $lte: weekEnd },
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
    findWeeklyConflicts(new mongoose.Types.ObjectId(driverId), weekStart, callerCo, dienstNumber),
    findWeeklyConflicts(new mongoose.Types.ObjectId(medicId), weekStart, callerCo, dienstNumber),
  ]);

  const driverConflictDates = new Set(
    driverConf
      .map((c) => normalizeDayKey(String(c.date)))
      .filter((x): x is string => x !== ""),
  );
  const medicConflictDates = new Set(
    medicConf
      .map((c) => normalizeDayKey(String(c.date)))
      .filter((x): x is string => x !== ""),
  );

  const { blockMap: dayBlockMap, reasonByDate } = await computeTeamDayAbsenceData({
    driverId,
    medicId,
    dates,
  });

  let working = (dienst.assignments || []).map((a) => {
    const src = ((a as any)?.toObject?.() ?? a) as any;
    const copy = { ...src };
    const rawDate = src?.date;
    if (rawDate != null) {
      const dk = normalizeDayKey(String(rawDate));
      if (dk) copy.date = dk;
    }
    return copy;
  });

  const skippedByVacation: Array<{ date: string; role: "driver" | "medic" }> = [];
  const skippedAbsences: Array<{
    date: string;
    role: "driver" | "medic";
    reason: "vacation" | "sick";
  }> = [];
  const skippedByWeeklyConflictSet = new Set<string>();

  const processableDays: Array<{ idx: number; dateKey: string; dateISO: string }> = [];

  for (let idx = 0; idx < dienst.assignments.length; idx++) {
    const a = dienst.assignments[idx] as any;
    if (!a?.date || !a?.startTime || !a?.endTime) continue;

    const dateISO = a.date;
    const dk = normalizeDayKey(String(dateISO));
    if (!dk) continue;

    processableDays.push({ idx, dateKey: dk, dateISO });
  }

  processableDays.sort((x, y) => x.dateKey.localeCompare(y.dateKey));

  let anyDayHasAssignableRole = false;
  for (const { idx, dateKey, dateISO } of processableDays) {
    const a = dienst.assignments[idx] as any;
    const block = dayBlockMap[dateISO] || { driver: false, medic: false };
    const rf =
      reasonByDate[dateISO] ??
      reasonByDate[normalizeDayKey(String(dateISO))] ??
      undefined;
    if (rf) {
      if (rf.driver.vacation) {
        skippedAbsences.push({ date: dateISO, role: "driver", reason: "vacation" });
      }
      if (rf.driver.sick) {
        skippedAbsences.push({ date: dateISO, role: "driver", reason: "sick" });
      }
      if (rf.medic.vacation) {
        skippedAbsences.push({ date: dateISO, role: "medic", reason: "vacation" });
      }
      if (rf.medic.sick) {
        skippedAbsences.push({ date: dateISO, role: "medic", reason: "sick" });
      }
    }
    if (block.driver) skippedByVacation.push({ date: dateISO, role: "driver" });
    if (block.medic) skippedByVacation.push({ date: dateISO, role: "medic" });

    if (driverConflictDates.has(dateKey)) skippedByWeeklyConflictSet.add(dateKey);
    if (medicConflictDates.has(dateKey)) skippedByWeeklyConflictSet.add(dateKey);

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

    const oppMed = (a as any).medic?.toString?.();
    const oppDrv = (a as any).driver?.toString?.();

    const driverOk =
      !block.driver &&
      driverPscheinOk &&
      !driverConflictDates.has(dateKey) &&
      !(oppMed && oppMed === driverId);

    const medicOk =
      !block.medic &&
      !medicConflictDates.has(dateKey) &&
      !(oppDrv && oppDrv === medicId);

    if (driverOk || medicOk) anyDayHasAssignableRole = true;
  }

  if (processableDays.length === 0 || !anyDayHasAssignableRole) {
    throw new DienstAssignmentError(
      409,
      "no_assignable_days",
      "No se pudo asignar el equipo ningún día (vacaciones, conflictos u otros filtros).",
      {
        skippedByVacation,
        skippedAbsences,
        skippedByWeeklyConflict: [...skippedByWeeklyConflictSet].sort(),
      },
    );
  }

  const driverOid = new mongoose.Types.ObjectId(driverId);
  const medicOid = new mongoose.Types.ObjectId(medicId);
  const uidDrv = String(driverId).trim();
  const uidMed = String(medicId).trim();

  let assignedCount = 0;
  const skippedByMinimumRest: string[] = [];
  const skippedByMinimumRestRoles: Array<{ date: string; role: "driver" | "medic" }> =
    [];
  const daysAssignedFull: string[] = [];
  const daysAssignedDriverOnly: string[] = [];
  const daysAssignedMedicOnly: string[] = [];
  let minimumRestWarning: MinimumRestWarningPayload | undefined;

  const resolveRestErr = (e: unknown): string => {
    if (e instanceof DienstAssignmentError) return e.code;
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      typeof (e as { code?: unknown }).code === "string"
    ) {
      return (e as { code: string }).code;
    }
    return "";
  };

  const rowHasTeamDriver = (r: any) => {
    const d = oidStr(r?.driver);
    return d !== "" && sameUserIdString(d, uidDrv);
  };
  const rowHasTeamMedic = (r: any) => {
    const m = oidStr(r?.medic);
    return m !== "" && sameUserIdString(m, uidMed);
  };

  for (const { idx, dateKey, dateISO } of processableDays) {
    const a = dienst.assignments[idx] as any;
    const block = dayBlockMap[dateISO] || { driver: false, medic: false };

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

    const oppMed = (a as any).medic?.toString?.();
    const oppDrv = (a as any).driver?.toString?.();

    const driverOk =
      !block.driver &&
      driverPscheinOk &&
      !driverConflictDates.has(dateKey) &&
      !(oppMed && oppMed === driverId);

    const medicOk =
      !block.medic &&
      !medicConflictDates.has(dateKey) &&
      !(oppDrv && oppDrv === medicId);

    if (!driverOk && !medicOk) continue;

    const rowStart = working[idx] as any;

    const runRest = async (
      nextRow: any,
      restOpts?: { restrictUserId: string; restrictRole: "driver" | "medic" },
    ) => {
      const mergedAssignments = working.map((x, j) =>
        j === idx ? nextRow : x,
      );
      return runMinimumRestChecksForMergedDienstStates(
        callerCo,
        [
          {
            id: String(dienst._id),
            mergedAssignments: mergedAssignments as unknown[],
          },
        ],
        [{ dienstId: String(dienst._id), date: dateKey }],
        restOpts,
      );
    };

    let applied = false;

    if (driverOk && medicOk) {
      const nextBoth = {
        ...rowStart,
        date: dateKey,
        driver: driverOid,
        medic: medicOid,
      } as any;
      if (teamAmbulanceId && !nextBoth.ambulanceId) {
        nextBoth.ambulanceId = teamAmbulanceId;
      }
      try {
        const rr = await runRest(nextBoth);
        working = working.map((x, j) => (j === idx ? nextBoth : x));
        if (rr.minimumRestWarning) minimumRestWarning = rr.minimumRestWarning;
        applied = true;
      } catch (e: unknown) {
        if (resolveRestErr(e) !== "insufficient_rest") throw e;
      }
    }

    if (!applied && driverOk) {
      const nextD = { ...rowStart, date: dateKey, driver: driverOid } as any;
      if (teamAmbulanceId && !nextD.ambulanceId) {
        nextD.ambulanceId = teamAmbulanceId;
      }
      try {
        const rr = await runRest(nextD, {
          restrictUserId: uidDrv,
          restrictRole: "driver",
        });
        working = working.map((x, j) => (j === idx ? nextD : x));
        if (rr.minimumRestWarning) minimumRestWarning = rr.minimumRestWarning;
        applied = true;
      } catch (e: unknown) {
        if (resolveRestErr(e) !== "insufficient_rest") throw e;
        skippedByMinimumRestRoles.push({ date: dateKey, role: "driver" });
      }
    }

    if (medicOk && !rowHasTeamMedic(working[idx])) {
      const rowNow = working[idx] as any;
      const nextM = { ...rowNow, date: dateKey, medic: medicOid } as any;
      if (teamAmbulanceId && !nextM.ambulanceId) {
        nextM.ambulanceId = teamAmbulanceId;
      }
      try {
        const rr = await runRest(nextM, {
          restrictUserId: uidMed,
          restrictRole: "medic",
        });
        working = working.map((x, j) => (j === idx ? nextM : x));
        if (rr.minimumRestWarning) minimumRestWarning = rr.minimumRestWarning;
        applied = true;
      } catch (e: unknown) {
        if (resolveRestErr(e) !== "insufficient_rest") throw e;
        skippedByMinimumRestRoles.push({ date: dateKey, role: "medic" });
      }
    }

    const rowEnd = working[idx] as any;
    const hasD = rowHasTeamDriver(rowEnd);
    const hasM = rowHasTeamMedic(rowEnd);

    if (hasD && hasM) {
      daysAssignedFull.push(dateKey);
      assignedCount += 1;
    } else if (hasD) {
      daysAssignedDriverOnly.push(dateKey);
      assignedCount += 1;
    } else if (hasM) {
      daysAssignedMedicOnly.push(dateKey);
      assignedCount += 1;
    } else if (driverOk || medicOk) {
      skippedByMinimumRest.push(dateKey);
    }
  }

  if (assignedCount === 0) {
    throw new DienstAssignmentError(
      409,
      "no_assignable_days_minimum_rest",
      "No se pudo asignar el equipo ningún día por descanso mínimo entre turnos.",
      {
        skippedByVacation,
        skippedAbsences,
        skippedByWeeklyConflict: [...skippedByWeeklyConflictSet].sort(),
        skippedByMinimumRest,
        skippedByMinimumRestRoles,
      },
    );
  }

  dienst.assignments = working as any;
  (dienst as any).weekTeamId = new mongoose.Types.ObjectId(teamId);
  await dienst.save();

  const driverAssigned = daysAssignedFull.length > 0 || daysAssignedDriverOnly.length > 0;
  const medicAssigned = daysAssignedFull.length > 0 || daysAssignedMedicOnly.length > 0;
  if (driverAssigned && driverId) {
    void sendPushNotification(
      [driverId],
      "Nueva asignación de turno",
      `Has sido asignado como conductor a ${daysAssignedFull.length + daysAssignedDriverOnly.length} día(s) del Dienst #${dienstNumber}.`,
      { screen: "agenda", date: weekStartDate },
    );
  }
  if (medicAssigned && medicId) {
    void sendPushNotification(
      [medicId],
      "Nueva asignación de turno",
      `Has sido asignado como sanitario a ${daysAssignedFull.length + daysAssignedMedicOnly.length} día(s) del Dienst #${dienstNumber}.`,
      { screen: "agenda", date: weekStartDate },
    );
  }

  const teamWorkerIds = new Set<string>();
  if (driverId) teamWorkerIds.add(driverId);
  if (medicId) teamWorkerIds.add(medicId);
  voidEmitSchedulingMutationRealtime(callerCo, teamWorkerIds);

  const skippedByWeeklyConflict = [...skippedByWeeklyConflictSet].sort();
  const hasPartialRoles =
    daysAssignedDriverOnly.length > 0 || daysAssignedMedicOnly.length > 0;
  const hasSkipReasons =
    skippedByMinimumRest.length > 0 ||
    skippedByWeeklyConflict.length > 0 ||
    skippedByVacation.length > 0;

  const parts: string[] = [];
  if (hasPartialRoles || hasSkipReasons) {
    if (daysAssignedFull.length > 0) {
      parts.push(`equipo completo: ${daysAssignedFull.join(", ")}`);
    }
    if (daysAssignedDriverOnly.length > 0) {
      parts.push(`solo conductor: ${daysAssignedDriverOnly.join(", ")}`);
    }
    if (daysAssignedMedicOnly.length > 0) {
      parts.push(`solo sanitario: ${daysAssignedMedicOnly.join(", ")}`);
    }
    if (skippedByMinimumRest.length > 0) {
      parts.push(`sin asignar por descanso mínimo: ${skippedByMinimumRest.join(", ")}`);
    }
    if (skippedByWeeklyConflict.length > 0) {
      parts.push(`conflicto otra guardia: ${skippedByWeeklyConflict.join(", ")}`);
    }
    if (skippedByVacation.length > 0) {
      parts.push(
        `vacaciones/baja: ${skippedByVacation.map((e) => `${e.date} (${e.role})`).join(", ")}`,
      );
    }
  }
  let message = `Team asignado en ${assignedCount} día(s) del Dienst #${dienstNumber} (${weekStartDate}).`;
  if (parts.length > 0) {
    message = `${message} Detalle — ${parts.join("; ")}.`;
  }

  return {
    message,
    updatedCount: assignedCount,
    skippedByVacation,
    skippedAbsences,
    skippedByWeeklyConflict,
    skippedByMinimumRest,
    skippedByMinimumRestRoles,
    daysAssignedFull,
    daysAssignedDriverOnly,
    daysAssignedMedicOnly,
    dienstId: dienst.id,
    weekStartDate,
    hints: { driverExpiredButBoth: !!driverExpiredButBothHint },
    ...(minimumRestWarning ? { minimumRestWarning } : {}),
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
): Promise<{ minimumRestWarning?: MinimumRestWarningPayload }> {
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

  let restResult: { minimumRestWarning?: MinimumRestWarningPayload } = {};
  let affectedWorkerIds = new Set<string>();

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
        callerCo,
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
      affectedWorkerIds = new Set(
        [userId, sd, sm, td, tm].filter((id): id is string => Boolean(id)),
      );

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

      restResult = await runMinimumRestChecksForMergedDienstStates(
        callerCo,
        [
          {
            id: String(sourceDienst._id),
            mergedAssignments: sourceDienst.assignments as unknown[],
          },
          {
            id: String(targetDienst._id),
            mergedAssignments: targetDienst.assignments as unknown[],
          },
        ],
        [{ dienstId: String(targetDienst._id), date: tgtKey }],
      );

      await sourceDienst.save({ session });
      await targetDienst.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (userId) {
    void sendPushNotification(
      [userId],
      "Turno reasignado",
      `Tu turno ha sido movido al ${targetDate}.`,
      { screen: "agenda", date: targetDate },
    );
  }
  voidEmitSchedulingMutationRealtime(callerCo, affectedWorkerIds);

  return restResult;
}

/**
 * DnD admin entre dos Dienst distintos de la misma semana (Berlin).
 * - Destino con hueco en el slot: equivalente a moveSlotSameWeek.
 * - Destino parcial con incumbent "both" y conductor/sanitario solo: rebalanceo atómico.
 * Mismo documento Dienst: error same_dienst_use_patch (PATCH en cliente).
 */
export async function dndCrossDienstSameWeek(
  body: DndCrossDienstSameWeekBody,
  companyId?: string | null,
): Promise<{ minimumRestWarning?: MinimumRestWarningPayload }> {
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
  const targetRole = body.targetRole ?? role;
  const sourceRole = role;

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

  let restResult: { minimumRestWarning?: MinimumRestWarningPayload } = {};
  let affectedWorkerIds = new Set<string>();

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
        sourceRole === "driver"
          ? oidStr(sourceAssignment.driver)
          : oidStr(sourceAssignment.medic);
      if (!sourceUserId || sourceUserId !== String(userId).trim()) {
        throw new DienstAssignmentError(
          409,
          "source_slot_mismatch",
          "El usuario no coincide con el slot de origen.",
        );
      }

      const td = oidStr(targetAssignment.driver);
      const tm = oidStr(targetAssignment.medic);
      if (td && tm) {
        throw new DienstAssignmentError(
          409,
          "target_full",
          "El destino ya tiene conductor y sanitario.",
        );
      }

      const draggedUser = await User.findById(userId)
        .select("companyId ambulanceRole")
        .session(session)
        .lean();
      if (!draggedUser) {
        throw new DienstAssignmentError(404, "user_not_found", "Usuario no encontrado.");
      }
      if (!entitiesBelongToSameCompany((draggedUser as any).companyId, callerCo)) {
        throw new DienstAssignmentError(403, "forbidden", "El usuario no pertenece a tu empresa");
      }
      const draggedAr = (draggedUser as any).ambulanceRole as
        | "driver"
        | "medic"
        | "both"
        | undefined;

      if (!isAmbulanceRoleValidForSlot(draggedAr, targetRole)) {
        throw new DienstAssignmentError(
          409,
          "dragged_role_mismatch",
          "El usuario no tiene rol de ambulancia válido para ese puesto en destino.",
        );
      }

      type DndMode = "simple" | "smart_driver" | "smart_medic";
      let mode: DndMode;

      if (targetRole === "driver" && !td) {
        mode = "simple";
      } else if (targetRole === "medic" && !tm) {
        mode = "simple";
      } else if (targetRole === "driver" && td && !tm) {
        const inc = await User.findById(td)
          .select("ambulanceRole")
          .session(session)
          .lean();
        if (!inc || String((inc as any).ambulanceRole) !== "both") {
          throw new DienstAssignmentError(
            409,
            "target_slot_not_empty",
            "No se puede soltar: el conductor ya está ocupado.",
          );
        }
        if (draggedAr !== "driver" && draggedAr !== "both") {
          throw new DienstAssignmentError(
            409,
            "dragged_role_mismatch",
            "Solo se puede reordenar arrastrando un conductor con rol driver.",
          );
        }
        if (String(userId).trim() === String(td).trim()) {
          throw new DienstAssignmentError(
            409,
            "driver_medic_same_user",
            "El conductor y el sanitario deben ser usuarios distintos.",
          );
        }
        mode = "smart_driver";
      } else if (targetRole === "medic" && tm && !td) {
        const inc = await User.findById(tm)
          .select("ambulanceRole")
          .session(session)
          .lean();
        if (!inc || String((inc as any).ambulanceRole) !== "both") {
          throw new DienstAssignmentError(
            409,
            "target_slot_not_empty",
            "No se puede soltar: el sanitario ya está ocupado.",
          );
        }
        if (draggedAr !== "medic" && draggedAr !== "both") {
          throw new DienstAssignmentError(
            409,
            "dragged_role_mismatch",
            "Solo se puede reordenar arrastrando un sanitario con rol medic.",
          );
        }
        if (String(userId).trim() === String(tm).trim()) {
          throw new DienstAssignmentError(
            409,
            "driver_medic_same_user",
            "El conductor y el sanitario deben ser usuarios distintos.",
          );
        }
        mode = "smart_medic";
      } else {
        throw new DienstAssignmentError(
          409,
          "target_slot_not_empty",
          "El destino no admite esta operación.",
        );
      }

      const userOid = new mongoose.Types.ObjectId(userId);

      const weeklyConf = await findWeeklyConflicts(
        userOid,
        weekStartDate,
        callerCo,
        (targetDienst as any).dienstNumber,
      );
      const filteredConf = weeklyConf.filter(
        (c) =>
          !(
            c.dienstId === String(sourceDienstId) &&
            normalizeDayKey(c.date) === srcKey &&
            c.role === sourceRole
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

      affectedWorkerIds = new Set(
        [userId, sd, sm, td, tm].filter((id): id is string => Boolean(id)),
      );

      let sourceRow: Record<string, unknown>;
      let targetRow: Record<string, unknown>;

      if (mode === "simple") {
        const targetOccupied =
          targetRole === "driver" ? td : tm;
        if (targetOccupied) {
          throw new DienstAssignmentError(
            409,
            "target_slot_not_empty",
            "El destino debe estar vacío.",
          );
        }

        if (sourceRole === "driver") {
          sourceRow = {
            date: sourceAssignment.date,
            startTime: sourceAssignment.startTime,
            endTime: sourceAssignment.endTime,
            driver: "",
            medic: sm || undefined,
          };
        } else {
          sourceRow = {
            date: sourceAssignment.date,
            startTime: sourceAssignment.startTime,
            endTime: sourceAssignment.endTime,
            driver: sd || undefined,
            medic: "",
          };
        }
        if (targetRole === "driver") {
          targetRow = {
            date: targetAssignment.date,
            startTime: targetAssignment.startTime,
            endTime: targetAssignment.endTime,
            driver: userId,
            medic: tm || undefined,
          };
        } else {
          targetRow = {
            date: targetAssignment.date,
            startTime: targetAssignment.startTime,
            endTime: targetAssignment.endTime,
            driver: td || undefined,
            medic: userId,
          };
        }
      } else if (mode === "smart_driver") {
        if (sourceRole === "driver") {
          sourceRow = {
            date: sourceAssignment.date,
            startTime: sourceAssignment.startTime,
            endTime: sourceAssignment.endTime,
            driver: "",
            medic: sm || undefined,
          };
        } else {
          sourceRow = {
            date: sourceAssignment.date,
            startTime: sourceAssignment.startTime,
            endTime: sourceAssignment.endTime,
            driver: sd || undefined,
            medic: "",
          };
        }
        targetRow = {
          date: targetAssignment.date,
          startTime: targetAssignment.startTime,
          endTime: targetAssignment.endTime,
          driver: userId,
          medic: td,
        };
      } else {
        if (sourceRole === "driver") {
          sourceRow = {
            date: sourceAssignment.date,
            startTime: sourceAssignment.startTime,
            endTime: sourceAssignment.endTime,
            driver: "",
            medic: sm || undefined,
          };
        } else {
          sourceRow = {
            date: sourceAssignment.date,
            startTime: sourceAssignment.startTime,
            endTime: sourceAssignment.endTime,
            driver: sd || undefined,
            medic: "",
          };
        }
        targetRow = {
          date: targetAssignment.date,
          startTime: targetAssignment.startTime,
          endTime: targetAssignment.endTime,
          driver: tm,
          medic: userId,
        };
      }

      await validateAssignmentEntities([sourceRow, targetRow] as any[], String(callerCo));

      const srcA = sourceDienst.assignments[sourceIdx] as any;
      const tgtA = targetDienst.assignments[targetIdx] as any;

      if (mode === "simple") {
        if (sourceRole === "driver") {
          srcA.driver = undefined;
          if ("driver" in srcA) delete srcA.driver;
        } else {
          srcA.medic = undefined;
          if ("medic" in srcA) delete srcA.medic;
        }
        if (targetRole === "driver") {
          tgtA.driver = new mongoose.Types.ObjectId(userId);
        } else {
          tgtA.medic = new mongoose.Types.ObjectId(userId);
        }
      } else if (mode === "smart_driver") {
        if (sourceRole === "driver") {
          srcA.driver = undefined;
          if ("driver" in srcA) delete srcA.driver;
        } else {
          srcA.medic = undefined;
          if ("medic" in srcA) delete srcA.medic;
        }
        tgtA.driver = new mongoose.Types.ObjectId(userId);
        tgtA.medic = new mongoose.Types.ObjectId(td);
      } else {
        if (sourceRole === "driver") {
          srcA.driver = undefined;
          if ("driver" in srcA) delete srcA.driver;
        } else {
          srcA.medic = undefined;
          if ("medic" in srcA) delete srcA.medic;
        }
        tgtA.driver = new mongoose.Types.ObjectId(tm);
        tgtA.medic = new mongoose.Types.ObjectId(userId);
      }

      restResult = await runMinimumRestChecksForMergedDienstStates(
        callerCo,
        [
          {
            id: String(sourceDienst._id),
            mergedAssignments: sourceDienst.assignments as unknown[],
          },
          {
            id: String(targetDienst._id),
            mergedAssignments: targetDienst.assignments as unknown[],
          },
        ],
        [{ dienstId: String(targetDienst._id), date: tgtKey }],
      );

      await sourceDienst.save({ session });
      await targetDienst.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (userId) {
    void sendPushNotification(
      [userId],
      "Turno reasignado",
      `Tu turno ha sido movido a un nuevo Dienst.`,
      { screen: "agenda", date: targetDate },
    );
  }
  voidEmitSchedulingMutationRealtime(callerCo, affectedWorkerIds);

  return restResult;
}

export async function assignAmbulanceToWeek(
  params: {
    dienstNumber: number;
    weekStartDate: string;
    ambulanceId: string;
  },
  companyId?: string | null,
): Promise<{
  message: string;
  updatedCount: number;
  dienstId: string;
  weekStartDate: string;
}> {
  const { dienstNumber, weekStartDate, ambulanceId } = params;

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

  if (!(await companyHasEnabledModule(callerCo, MODULE_KEYS.AMBULANCES))) {
    throw new DienstAssignmentError(
      403,
      "ambulances_module_disabled",
      "El módulo de ambulancias no está habilitado para esta empresa.",
    );
  }

  const { start: weekStart, end: weekEnd } = getWeekMongoDateRange(weekStartDate);

  const dienst = await Dienst.findOne({
    dienstNumber,
    weekStartDate: { $gte: weekStart, $lte: weekEnd },
    companyId: new mongoose.Types.ObjectId(callerCo),
  });

  if (!dienst) {
    throw new DienstAssignmentError(
      404,
      "dienst_not_found",
      "No existe Dienst para esa semana y número",
    );
  }

  const ambulance = await Ambulance.findById(ambulanceId).select("companyId").lean();
  if (!ambulance) {
    throw new DienstAssignmentError(404, "ambulance_not_found", "Ambulancia no encontrada");
  }
  if (!entitiesBelongToSameCompany((ambulance as any).companyId, callerCo)) {
    throw new DienstAssignmentError(403, "forbidden", "La ambulancia no pertenece a tu empresa");
  }

  const ambObjectId = new mongoose.Types.ObjectId(ambulanceId);

  const assignmentsToCheck = dienst.assignments
    .filter((a) => a?.date && a?.startTime && a?.endTime)
    .map((a) => ({ date: a.date, startTime: a.startTime, endTime: a.endTime }));

  if (assignmentsToCheck.length > 0) {
    const conflicts = await findAmbulanceTimeConflicts({
      ambulanceId: ambObjectId,
      currentDienstId: dienst._id as mongoose.Types.ObjectId,
      assignments: assignmentsToCheck,
      companyId: callerCo,
    });

    if (conflicts.length > 0) {
      throw new DienstAssignmentError(
        409,
        "ambulance_time_conflict",
        formatAmbulanceConflictMessage(conflicts[0]!),
        conflicts,
      );
    }
  }

  let updatedCount = 0;

  const weekWorkerIds = new Set<string>();
  for (const a of dienst.assignments) {
    const dId = oidStr((a as any).driver);
    const mId = oidStr((a as any).medic);
    if (dId) weekWorkerIds.add(dId);
    if (mId) weekWorkerIds.add(mId);
  }

  dienst.assignments = dienst.assignments.map((a) => {
    if (!a?.date || !a?.startTime || !a?.endTime) return a;
    updatedCount += 1;
    (a as any).ambulanceId = ambObjectId;
    return a;
  });

  await dienst.save();

  if (weekWorkerIds.size > 0) {
    void sendPushNotification(
      [...weekWorkerIds],
      "Ambulancia asignada",
      `Se ha asignado una ambulancia a tu turno del Dienst #${dienstNumber}.`,
      { screen: "agenda", date: weekStartDate },
    );
  }
  voidEmitSchedulingMutationRealtime(callerCo, weekWorkerIds);

  return {
    message: `Ambulancia asignada a Dienst #${dienstNumber} (${weekStartDate}). ${updatedCount} días actualizados.`,
    updatedCount,
    dienstId: dienst.id,
    weekStartDate,
  };
}
