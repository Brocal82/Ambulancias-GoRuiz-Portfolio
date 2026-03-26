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
  computeDayBlockMapForTeam,
  isDriverEligibleForAssignmentDate,
} from "../../utils/dienstValidation";
import {
  entitiesBelongToSameCompany,
  CompanyValidationError,
} from "../../../../utils/requireCompany";
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

export async function createDienst(data: DienstCreateInput, companyId?: string | null) {
  const dienstCompanyId = companyId != null && companyId !== "" ? String(companyId) : null;
  await validateAssignmentCompanies(
    (data.assignments || []) as Array<{ ambulanceId?: string; driver?: string; medic?: string }>,
    dienstCompanyId,
  );
  const payload = companyId
    ? { ...data, companyId: new mongoose.Types.ObjectId(companyId) }
    : data;
  const newDienst = new Dienst(payload);
  return newDienst.save();
}

export async function updateDienst(
  id: string,
  data: DienstUpdateInput,
  companyId?: string | null,
) {
  const existing = await Dienst.findById(id).select("companyId").lean();
  if (!existing) return null;
  const existingCompany = (existing as any).companyId;
  if (existingCompany) {
    if (!companyId || String(existingCompany) !== String(companyId)) {
      return null;
    }
  }
  const dienstCompanyId =
    existingCompany != null ? String(existingCompany) : companyId != null && companyId !== "" ? String(companyId) : null;
  if (data.assignments && data.assignments.length > 0) {
    const assignList = data.assignments as Array<{ ambulanceId?: string; driver?: string; medic?: string }>;
    await validateAssignmentCompanies(assignList, dienstCompanyId);
  }
  return Dienst.findByIdAndUpdate(id, data, {
    new: true,
  }).populate("assignments.driver assignments.medic assignments.ambulanceId");
}

export async function deleteDienst(id: string, companyId?: string | null) {
  const existing = await Dienst.findById(id).select("companyId").lean();
  if (!existing) return null;
  const existingCompany = (existing as any).companyId;
  if (existingCompany) {
    if (!companyId || String(existingCompany) !== String(companyId)) {
      return null;
    }
  }
  return Dienst.findByIdAndDelete(id);
}

export async function deleteDienstsForWeek(
  weekStartDate: string,
  companyId?: string | null,
): Promise<{ deletedCount: number }> {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const weekRange = { weekStartDate: { $gte: start, $lte: end } };
  const callerHasCompany =
    companyId != null && String(companyId).trim() !== "";

  const filter: Record<string, unknown> = callerHasCompany
    ? {
        ...weekRange,
        companyId: new mongoose.Types.ObjectId(String(companyId).trim()),
      }
    : {
        $and: [
          weekRange,
          {
            $or: [{ companyId: null }, { companyId: { $exists: false } }],
          },
        ],
      };

  const deleted = await Dienst.deleteMany(filter);
  return { deletedCount: deleted.deletedCount ?? 0 };
}

export async function generateDienstTemplatesForWeek(
  weekStartDate: string,
  companyId?: string | null,
): Promise<{ count: number }> {
  const companyIdStr =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : null;
  if (!companyIdStr) {
    throw new Error("Se requiere pertenecer a una empresa.");
  }
  const companyOid = new mongoose.Types.ObjectId(companyIdStr);

  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

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

  const dienstNumbers = templates.map((tpl) => tpl.dienstNumber);

  let teams = await Team.find(
    {},
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
      "companyId ambulanceRole pscheinExpiry pscheinConfirmedAt",
    )
    .populate("medic", "companyId")
    .lean();

  teams = teams.filter((t: any) => {
    const drvCo = t.driver?.companyId ? String(t.driver.companyId) : null;
    const medCo = t.medic?.companyId ? String(t.medic.companyId) : null;
    return drvCo === companyIdStr && medCo === companyIdStr;
  });

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

  const prevWeekStart = new Date(startDate);
  prevWeekStart.setDate(startDate.getDate() - 7);
  prevWeekStart.setHours(0, 0, 0, 0);

  const prevWeekNextDay = new Date(
    prevWeekStart.getTime() + 24 * 60 * 60 * 1000,
  );

  const prevWeekFilter: Record<string, unknown> = {
    weekStartDate: { $gte: prevWeekStart, $lt: prevWeekNextDay },
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

      for (const prev of prevDiensts) {
        const dn = (prev as any).dienstNumber;
        if (!freeDienstNumbers.includes(dn)) continue;

        const weekTeamId = (prev as any).weekTeamId
          ? String((prev as any).weekTeamId)
          : null;
        if (weekTeamId && teamById.has(weekTeamId)) {
          prevAnchorsByDienst.set(dn, teamById.get(weekTeamId)!);
        }
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

      for (let i = 0; i < freeCount; i++) {
        const fromDienst = freeDienstNumbers[i];
        const team = prevAnchorsByDienst.get(fromDienst);
        if (!team) continue;

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
      }
    }
  }

  const dienstsToInsert = await Promise.all(
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

      const weekDates = Array.from({ length: 7 }, (_, j) => {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + j);
        return day.toISOString().split("T")[0];
      });
      const dayBlockMap = await computeDayBlockMapForTeam({
        driverId: driverIdStr,
        medicId: medicIdStr,
        dates: weekDates,
      });

      for (let j = 0; j < 7; j++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + j);

        const weekDayIndex = day.getDay();

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

        const dateISO = day.toISOString().split("T")[0];

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

        if (teamAmbulanceId) {
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
      return doc;
    }),
  );

  await Dienst.insertMany(dienstsToInsert);

  return { count: dienstsToInsert.length };
}
