import mongoose from "mongoose";
import Dienst from "../../models/dienst.model";
import { Team } from "../../../teams";
import { Ambulance } from "../../../ambulances";
import User from "../../../users/models/user.model";
import {
  DienstTemplate,
  type DaySchedule,
} from "../../../dienst-templates/models";
import {
  computeTeamDayAbsenceData,
  isDriverEligibleForAssignmentDate,
} from "../../utils/dienstValidation";
import {
  entitiesBelongToSameCompany,
  CompanyValidationError,
} from "../../../../utils/requireCompany";
import { companyHasEnabledModule } from "../../../../utils/companyEnabledModules";
import { MODULE_KEYS } from "../../../companies/constants/modules.constants";
import {
  collectWorkerIdsFromAssignments,
  sendPushNotification,
  voidEmitDienstPlanningChanged,
  voidEmitSchedulingMutationRealtime,
} from "../../../notifications";
import {
  getWeekMongoDateRange,
  parseWeekStartISO,
} from "../../../../utils/time";
import {
  findDienstWeekDownstreamReferences,
  DeleteWeekConflictError,
} from "../../utils/dienstWeekReferences";
import type { z } from "zod";
import type { dienstSchema } from "../../schemas/dienstSchema";

type DienstCreateInput = z.infer<typeof dienstSchema>;
type DienstUpdateInput = Partial<DienstCreateInput>;

/** User ref from Team (ObjectId, id string, or populated { _id, ... }). */
function teamMemberRefToIdString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = v.trim();
    return s !== "" ? s : undefined;
  }
  if (v instanceof mongoose.Types.ObjectId) return v.toString();
  if (typeof v === "object" && "_id" in v && (v as { _id: unknown })._id != null) {
    const id = (v as { _id: unknown })._id;
    if (id instanceof mongoose.Types.ObjectId) return id.toString();
    if (typeof id === "string") {
      const s = id.trim();
      return s !== "" ? s : undefined;
    }
  }
  return undefined;
}

async function validateAssignmentCompanies(
  assignments: Array<{ ambulanceId?: string; driver?: string; medic?: string }>,
  dienstCompanyId: string | null,
) {
  for (const a of assignments || []) {
    if (a.ambulanceId) {
      const amb = await Ambulance.findById(a.ambulanceId).select("companyId").lean();
      if (!amb) throw new CompanyValidationError("Ambulancia no encontrada");
      const ambCo = (amb as { companyId?: unknown }).companyId;
      if (!entitiesBelongToSameCompany(ambCo, dienstCompanyId)) {
        throw new CompanyValidationError("La ambulancia no pertenece a tu empresa");
      }
    }
    if (a.driver) {
      const u = await User.findById(a.driver).select("companyId").lean();
      if (!u) throw new CompanyValidationError("Conductor no encontrado");
      const uCo = (u as { companyId?: unknown }).companyId;
      if (!entitiesBelongToSameCompany(uCo, dienstCompanyId)) {
        throw new CompanyValidationError("El conductor no pertenece a tu empresa");
      }
    }
    if (a.medic) {
      const u = await User.findById(a.medic).select("companyId").lean();
      if (!u) throw new CompanyValidationError("Sanitario no encontrado");
      const uCo = (u as { companyId?: unknown }).companyId;
      if (!entitiesBelongToSameCompany(uCo, dienstCompanyId)) {
        throw new CompanyValidationError("El sanitario no pertenece a tu empresa");
      }
    }
  }
}

async function assertAmbulancesPayloadAllowedForCompany(
  assignments: Array<{ ambulanceId?: unknown }> | undefined,
  companyIdStr: string,
) {
  const hasAmbulance = (assignments ?? []).some((a) => {
    const id = a?.ambulanceId;
    if (id == null || id === "") return false;
    if (typeof id === "string" && id.trim() === "") return false;
    return true;
  });
  if (!hasAmbulance) return;
  if (!(await companyHasEnabledModule(companyIdStr, MODULE_KEYS.AMBULANCES))) {
    throw new CompanyValidationError(
      "El módulo de ambulancias no está habilitado para esta empresa.",
    );
  }
}

export async function createDienst(data: DienstCreateInput, companyId?: string | null) {
  if (companyId == null || String(companyId).trim() === "") {
    throw new CompanyValidationError(
      "No tienes permiso. Se requiere pertenecer a una empresa.",
    );
  }
  const companyIdStr = String(companyId).trim();
  await assertAmbulancesPayloadAllowedForCompany(
    data.assignments as Array<{ ambulanceId?: unknown }> | undefined,
    companyIdStr,
  );
  await validateAssignmentCompanies(
    (data.assignments || []) as Array<{ ambulanceId?: string; driver?: string; medic?: string }>,
    companyIdStr,
  );
  const payload = {
    ...data,
    companyId: new mongoose.Types.ObjectId(companyIdStr),
  };
  const newDienst = new Dienst(payload);
  const saved = await newDienst.save();
  voidEmitSchedulingMutationRealtime(
    companyIdStr,
    collectWorkerIdsFromAssignments(
      (data.assignments || []) as Array<{ driver?: unknown; medic?: unknown }>,
    ),
  );
  return saved;
}

export async function updateDienst(
  id: string,
  data: DienstUpdateInput,
  companyId?: string | null,
) {
  const existing = await Dienst.findById(id).select("companyId assignments").lean();
  if (!existing) return null;
  const existingCompany = (existing as any).companyId;
  if (existingCompany == null) {
    return null;
  }
  if (!companyId || String(existingCompany) !== String(companyId)) {
    return null;
  }
  const dienstCompanyId = String(existingCompany);
  if (data.assignments && data.assignments.length > 0) {
    await assertAmbulancesPayloadAllowedForCompany(
      data.assignments as Array<{ ambulanceId?: unknown }>,
      dienstCompanyId,
    );
    const assignList = data.assignments as Array<{ ambulanceId?: string; driver?: string; medic?: string }>;
    await validateAssignmentCompanies(assignList, dienstCompanyId);
  }
  const updated = await Dienst.findByIdAndUpdate(id, data, {
    new: true,
  }).populate("assignments.driver assignments.medic assignments.ambulanceId");
  if (updated) {
    if (data.assignments !== undefined) {
      const oldWorkers = collectWorkerIdsFromAssignments(
        (existing as { assignments?: Array<{ driver?: unknown; medic?: unknown }> }).assignments,
      );
      const newWorkers = collectWorkerIdsFromAssignments(
        data.assignments as Array<{ driver?: unknown; medic?: unknown }>,
      );
      const affected = new Set<string>([...oldWorkers, ...newWorkers]);
      voidEmitSchedulingMutationRealtime(dienstCompanyId, affected);
    } else {
      voidEmitDienstPlanningChanged(dienstCompanyId);
    }
  }
  return updated;
}

export async function deleteDienst(id: string, companyId?: string | null) {
  const existing = await Dienst.findById(id).select("companyId assignments").lean();
  if (!existing) return null;
  const existingCompany = (existing as any).companyId;
  if (existingCompany == null) {
    return null;
  }
  if (!companyId || String(existingCompany) !== String(companyId)) {
    return null;
  }
  const dienstCompanyId = String(existingCompany);
  const affectedWorkers = collectWorkerIdsFromAssignments(
    (existing as { assignments?: Array<{ driver?: unknown; medic?: unknown }> }).assignments,
  );
  const deleted = await Dienst.findByIdAndDelete(id);
  if (deleted) {
    voidEmitSchedulingMutationRealtime(dienstCompanyId, affectedWorkers);
  }
  return deleted;
}

export async function deleteDienstsForWeek(
  weekStartDate: string,
  companyId?: string | null,
): Promise<{ deletedCount: number }> {
  if (companyId == null || String(companyId).trim() === "") {
    throw new CompanyValidationError(
      "No tienes permiso. Se requiere pertenecer a una empresa.",
    );
  }
  const companyIdStr = String(companyId).trim();
  const companyOid = new mongoose.Types.ObjectId(companyIdStr);
  const { start, end, weekDates } = getWeekMongoDateRange(weekStartDate);

  const weekRange = { weekStartDate: { $gte: start, $lte: end } };
  const filter: Record<string, unknown> = {
    ...weekRange,
    companyId: companyOid,
  };

  const dienstsInWeek = await Dienst.find(filter)
    .select("dienstNumber assignments")
    .lean();

  const affectedWorkers = new Set<string>();
  const assignmentIds: mongoose.Types.ObjectId[] = [];
  const dienstNumbers = new Set<number>();
  for (const d of dienstsInWeek) {
    if (typeof (d as { dienstNumber?: number }).dienstNumber === "number") {
      dienstNumbers.add((d as { dienstNumber: number }).dienstNumber);
    }
    for (const workerId of collectWorkerIdsFromAssignments(
      (d as { assignments?: Array<{ driver?: unknown; medic?: unknown }> }).assignments,
    )) {
      affectedWorkers.add(workerId);
    }
    for (const a of (d as { assignments?: Array<{ _id?: unknown }> }).assignments ??
      []) {
      if (a._id == null) continue;
      const idStr = String(a._id);
      if (!mongoose.Types.ObjectId.isValid(idStr)) continue;
      assignmentIds.push(new mongoose.Types.ObjectId(idStr));
    }
  }

  const refs = await findDienstWeekDownstreamReferences({
    companyId: companyIdStr,
    assignmentIds,
    weekDateISOs: weekDates,
    dienstNumbers: [...dienstNumbers],
  });
  if (refs.inUse) {
    throw new DeleteWeekConflictError(refs.sources, refs.counts);
  }

  const deleted = await Dienst.deleteMany(filter);
  if ((deleted.deletedCount ?? 0) > 0) {
    voidEmitSchedulingMutationRealtime(companyIdStr, affectedWorkers);
  }
  return { deletedCount: deleted.deletedCount ?? 0 };
}

export type GenerateWeekDienstSummary = {
  dienstNumber: number;
  skippedAbsences: Array<{
    date: string;
    role: "driver" | "medic";
    reason: "vacation" | "sick";
    workerName?: string;
  }>;
};

/** One aggregated push per assigned worker after generate-week insert succeeds. */
export function notifyGeneratedWeekAssignedWorkers(
  companyIdStr: string,
  weekStartDate: string,
  generatedWorkers: Iterable<string>,
): void {
  const workerIds = [...new Set(generatedWorkers)];
  if (workerIds.length === 0) return;

  void sendPushNotification(
    workerIds,
    "Nueva semana de turnos",
    `Se han generado nuevas asignaciones en tu agenda para la semana del ${weekStartDate}.`,
    { screen: "agenda", date: weekStartDate },
    { moduleKey: MODULE_KEYS.SCHEDULING, actingCompanyId: companyIdStr },
  );
}

export async function generateDienstTemplatesForWeek(
  weekStartDate: string,
  companyId?: string | null,
): Promise<{ count: number; dienstSummaries: GenerateWeekDienstSummary[] }> {
  const companyIdStr =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!companyIdStr) {
    throw new Error("Se requiere pertenecer a una empresa.");
  }
  const companyOid = new mongoose.Types.ObjectId(companyIdStr);

  const {
    start: startDate,
    end: endDate,
    weekDates: weekDateStrings,
  } = getWeekMongoDateRange(weekStartDate);

  const weekFilter: Record<string, unknown> = {
    weekStartDate: { $gte: startDate, $lte: endDate },
    companyId: companyOid,
  };
  const existing = await Dienst.find(weekFilter);

  if (existing.length > 0) {
    throw new Error("Ya existen Diensts para esa semana");
  }

  const templates = await DienstTemplate.find({
    companyId: companyOid,
    isActive: true,
  })
    .sort({ dienstNumber: 1 })
    .lean();

  if (!templates || templates.length === 0) {
    throw new Error(
      "No hay plantillas de Dienst activas. Crea al menos una antes de generar la semana.",
    );
  }

  const ambulancesModuleEnabled = await companyHasEnabledModule(
    companyIdStr,
    MODULE_KEYS.AMBULANCES,
  );

  const dienstNumbers = templates.map((tpl) => tpl.dienstNumber);

  const teams = await Team.find(
    { companyId: companyOid },
    {
      driver: 1,
      medic: 1,
      rotationMode: 1,
      fixedDienstNumber: 1,
      createdAt: 1,
      ambulanceId: 1,
    },
  )
    .populate(
      "driver",
      "companyId ambulanceRole pscheinExpiry pscheinConfirmedAt name lastName",
    )
    .populate("medic", "companyId name lastName ambulanceRole")
    .lean();

  const fixedMap = new Map<number, (typeof teams)[0]>();
  const rotatingTeams: (typeof teams)[0][] = [];

  for (const team of teams) {
    const mode = (team as any).rotationMode ?? "rotating";
    const fixedNum = (team as any).fixedDienstNumber as number | null | undefined;

    if (mode === "fixed" && fixedNum && dienstNumbers.includes(fixedNum)) {
      fixedMap.set(fixedNum, team);
    } else if (mode === "rotating") {
      rotatingTeams.push(team);
    }
  }

  const prevWeekStartDt = parseWeekStartISO(weekStartDate)
    .minus({ days: 7 })
    .startOf("day");
  const prevWeekNextDay = prevWeekStartDt.plus({ days: 1 }).startOf("day");

  const prevWeekFilter: Record<string, unknown> = {
    weekStartDate: {
      $gte: prevWeekStartDt.toJSDate(),
      $lt: prevWeekNextDay.toJSDate(),
    },
    companyId: companyOid,
  };
  const prevDiensts = await Dienst.find(prevWeekFilter).lean();

  const hasPreviousWeek = prevDiensts.length > 0;

  const dienstToTeam = new Map<number, (typeof teams)[0]>();

  for (const num of dienstNumbers) {
    if (fixedMap.has(num)) {
      dienstToTeam.set(num, fixedMap.get(num)!);
    }
  }

  if (!hasPreviousWeek) {
  } else {
    const freeDienstNumbers = dienstNumbers
      .filter((num) => !fixedMap.has(num))
      .sort((a, b) => a - b);

    const freeCount = freeDienstNumbers.length;

    if (freeCount > 0 && rotatingTeams.length > 0) {
      const teamById = new Map<string, (typeof teams)[0]>();
      for (const t of rotatingTeams) teamById.set(String((t as any)._id), t);

      const prevAnchorsByDienst = new Map<number, (typeof teams)[0]>();
      const anchoredTeamIds = new Set<string>();

      const prevDienstsSorted = [...prevDiensts].sort(
        (a, b) => Number((a as any).dienstNumber) - Number((b as any).dienstNumber),
      );

      for (const prev of prevDienstsSorted) {
        const dn = (prev as any).dienstNumber;
        if (!freeDienstNumbers.includes(dn)) continue;

        const weekTeamId = (prev as any).weekTeamId
          ? String((prev as any).weekTeamId)
          : null;
        if (!weekTeamId || !teamById.has(weekTeamId)) continue;

        if (anchoredTeamIds.has(weekTeamId)) {
          console.warn(
            `[generate-week] duplicate rotation anchor ignored: team=${weekTeamId} dienst=${dn} company=${companyIdStr}`,
          );
          continue;
        }

        prevAnchorsByDienst.set(dn, teamById.get(weekTeamId)!);
        anchoredTeamIds.add(weekTeamId);
      }

      if (prevAnchorsByDienst.size === 0) {
        const usedTeams = new Set<string>();

        for (const prev of prevDiensts) {
          const dn = (prev as any).dienstNumber;
          if (!freeDienstNumbers.includes(dn)) continue;

          const assignments = (prev as any).assignments || [];

          for (const team of rotatingTeams) {
            const tid = String((team as any)._id);
            if (usedTeams.has(tid)) continue;

            const tDrv = team.driver ? String(team.driver) : null;
            const tMed = team.medic ? String(team.medic) : null;

            const match = assignments.some(
              (a: any) =>
                (tDrv && a?.driver && String(a.driver) === tDrv) ||
                (tMed && a?.medic && String(a.medic) === tMed),
            );

            if (match) {
              prevAnchorsByDienst.set(dn, team);
              usedTeams.add(tid);
              break;
            }
          }
        }
      }

      const usedTargets = new Set<number>();
      const rotatedTeamIds = new Set<string>();

      for (let i = 0; i < freeCount; i++) {
        const fromDienst = freeDienstNumbers[i];
        const team = prevAnchorsByDienst.get(fromDienst);
        if (!team) continue;

        const teamId = String((team as any)._id);
        if (rotatedTeamIds.has(teamId)) continue;

        let newIndex = (i + 1) % freeCount;

        let tries = 0;
        while (
          tries < freeCount &&
          (usedTargets.has(freeDienstNumbers[newIndex]) ||
            dienstToTeam.has(freeDienstNumbers[newIndex]))
        ) {
          newIndex = (newIndex + 1) % freeCount;
          tries++;
        }

        if (tries >= freeCount) continue;

        const targetDienst = freeDienstNumbers[newIndex];
        dienstToTeam.set(targetDienst, team);
        usedTargets.add(targetDienst);
        rotatedTeamIds.add(teamId);
      }
    }
  }

  const built = await Promise.all(
    templates.map(async (tpl: any) => {
      const dienstNumber = tpl.dienstNumber;
      const templateStartTime = tpl.startTime;
      const templateEndTime = tpl.endTime;
      const daysOff = Array.isArray(tpl.daysOff) ? tpl.daysOff : [];
      const daysOffSet = new Set<number>(daysOff);

      const perDaySchedule: DaySchedule[] | undefined = Array.isArray(
        tpl.perDaySchedule,
      )
        ? (tpl.perDaySchedule as DaySchedule[])
        : undefined;

      const usePerDaySchedule = !!(
        perDaySchedule && perDaySchedule.length > 0
      );

      const assignments: {
        date: string;
        startTime: string;
        endTime: string;
        driver?: mongoose.Types.ObjectId;
        medic?: mongoose.Types.ObjectId;
        ambulanceId?: mongoose.Types.ObjectId;
      }[] = [];

      const assignedTeam = dienstToTeam.get(dienstNumber);

      const driverIdStr = teamMemberRefToIdString(assignedTeam?.driver);
      const medicIdStr = teamMemberRefToIdString(assignedTeam?.medic);

      const teamAmbulanceId =
        assignedTeam && (assignedTeam as any).ambulanceId
          ? new mongoose.Types.ObjectId(
              String((assignedTeam as any).ambulanceId),
            )
          : undefined;

      const { blockMap: dayBlockMap, reasonByDate } =
        await computeTeamDayAbsenceData({
          driverId: driverIdStr,
          medicId: medicIdStr,
          dates: weekDateStrings,
        });

      const skippedAbsences: Array<{
        date: string;
        role: "driver" | "medic";
        reason: "vacation" | "sick";
        workerName?: string;
      }> = [];

      const workerLabel = (u: any): string | undefined => {
        if (!u) return undefined;
        const ln = typeof u.lastName === "string" ? u.lastName : "";
        const n = typeof u.name === "string" ? u.name : "";
        const label = `${ln}${ln ? ", " : ""}${n}`.trim();
        return label || undefined;
      };
      const driverWorkerName = workerLabel(assignedTeam?.driver);
      const medicWorkerName = workerLabel(assignedTeam?.medic);

      for (let j = 0; j < 7; j++) {
        const dayDt = parseWeekStartISO(weekStartDate).plus({ days: j });
        const weekDayIndex = dayDt.weekday % 7;

        let startTimeForDay: string;
        let endTimeForDay: string;

        if (usePerDaySchedule) {
          const dayCfg = perDaySchedule!.find(
            (d) => d.dayIndex === weekDayIndex,
          );

          if (dayCfg && dayCfg.isOff) {
            continue;
          }

          startTimeForDay = (dayCfg && dayCfg.startTime) || templateStartTime;
          endTimeForDay = (dayCfg && dayCfg.endTime) || templateEndTime;
        } else {
          if (daysOffSet.has(weekDayIndex)) {
            continue;
          }
          startTimeForDay = templateStartTime;
          endTimeForDay = templateEndTime;
        }

        const dateISO = weekDateStrings[j]!;
        const rf = reasonByDate[dateISO];
        if (rf) {
          if (rf.driver.vacation) {
            skippedAbsences.push({ date: dateISO, role: "driver", reason: "vacation", workerName: driverWorkerName });
          }
          if (rf.driver.sick) {
            skippedAbsences.push({ date: dateISO, role: "driver", reason: "sick", workerName: driverWorkerName });
          }
          if (rf.medic.vacation) {
            skippedAbsences.push({ date: dateISO, role: "medic", reason: "vacation", workerName: medicWorkerName });
          }
          if (rf.medic.sick) {
            skippedAbsences.push({ date: dateISO, role: "medic", reason: "sick", workerName: medicWorkerName });
          }
        }

        const baseAssignment: {
          date: string;
          startTime: string;
          endTime: string;
          driver?: mongoose.Types.ObjectId;
          medic?: mongoose.Types.ObjectId;
          ambulanceId?: mongoose.Types.ObjectId;
        } = {
          date: dateISO,
          startTime: startTimeForDay,
          endTime: endTimeForDay,
        };

        const block = dayBlockMap[dateISO] || { driver: false, medic: false };

        if (driverIdStr && !block.driver) {
          const drvPop = assignedTeam?.driver as
            | {
                ambulanceRole?: "driver" | "medic" | "both";
                pscheinExpiry?: string;
                pscheinConfirmedAt?: Date | string | null;
              }
            | undefined;
          const driverEligibleForDay =
            typeof drvPop === "object" &&
            drvPop != null &&
            isDriverEligibleForAssignmentDate({
              ambulanceRole: drvPop.ambulanceRole,
              pscheinExpiry: drvPop.pscheinExpiry,
              pscheinConfirmedAt: drvPop.pscheinConfirmedAt,
              assignmentDateISO: dateISO,
            });
          if (driverEligibleForDay) {
            baseAssignment.driver = new mongoose.Types.ObjectId(driverIdStr);
          }
        }

        if (medicIdStr && !block.medic) {
          baseAssignment.medic = new mongoose.Types.ObjectId(medicIdStr);
        }

        if (teamAmbulanceId && ambulancesModuleEnabled) {
          baseAssignment.ambulanceId = teamAmbulanceId;
        }

        assignments.push(baseAssignment);
      }

      const doc: Record<string, unknown> = {
        dienstNumber,
        weekStartDate: startDate,
        weekEndDate: endDate,
        assignments,
        weekTeamId: assignedTeam
          ? new mongoose.Types.ObjectId(String((assignedTeam as any)._id))
          : null,
      };
      doc.companyId = companyOid;
      return {
        doc,
        dienstNumber,
        skippedAbsences,
      };
    }),
  );

  await Dienst.insertMany(built.map((b) => b.doc));

  const generatedWorkers = new Set<string>();
  for (const item of built) {
    for (const workerId of collectWorkerIdsFromAssignments(
      (item.doc.assignments || []) as Array<{ driver?: unknown; medic?: unknown }>,
    )) {
      generatedWorkers.add(workerId);
    }
  }
  notifyGeneratedWeekAssignedWorkers(companyIdStr, weekStartDate, generatedWorkers);
  voidEmitSchedulingMutationRealtime(companyIdStr, generatedWorkers);

  return {
    count: built.length,
    dienstSummaries: built.map((b) => ({
      dienstNumber: b.dienstNumber,
      skippedAbsences: b.skippedAbsences,
    })),
  };
}
