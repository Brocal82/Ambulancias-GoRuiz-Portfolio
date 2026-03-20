import mongoose from "mongoose";
import Dienst from "../../../../models/Dienst";
import Team from "../../../../models/Team";
import {
  DienstTemplate,
  type DaySchedule,
} from "../../../dienst-templates/models";
import { computeDayBlockMapForTeam } from "../../../../utils/dienstValidation";
import type { z } from "zod";
import type { dienstSchema } from "../../schemas/dienstSchema";

type DienstCreateInput = z.infer<typeof dienstSchema>;
type DienstUpdateInput = Partial<DienstCreateInput>;

export async function createDienst(data: DienstCreateInput) {
  const newDienst = new Dienst(data);
  return newDienst.save();
}

export async function updateDienst(id: string, data: DienstUpdateInput) {
  return Dienst.findByIdAndUpdate(id, data, {
    new: true,
  }).populate("assignments.driver assignments.medic assignments.ambulanceId");
}

export async function deleteDienst(id: string) {
  return Dienst.findByIdAndDelete(id);
}

export async function deleteDienstsForWeek(weekStartDate: string): Promise<{
  deletedCount: number;
}> {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const deleted = await Dienst.deleteMany({
    weekStartDate: {
      $gte: start,
      $lte: end,
    },
  });

  return { deletedCount: deleted.deletedCount ?? 0 };
}

export async function generateDienstTemplatesForWeek(weekStartDate: string): Promise<{
  count: number;
}> {
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const existing = await Dienst.find({
    weekStartDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  if (existing.length > 0) {
    throw new Error("Ya existen Diensts para esa semana");
  }

  const templates = await DienstTemplate.find({ isActive: true })
    .sort({ dienstNumber: 1 })
    .lean();

  if (!templates || templates.length === 0) {
    throw new Error(
      "No hay plantillas de Dienst activas. Crea al menos una antes de generar la semana.",
    );
  }

  const dienstNumbers = templates.map((tpl) => tpl.dienstNumber);

  const teams = await Team.find(
    {},
    {
      driver: 1,
      medic: 1,
      rotationMode: 1,
      fixedDienstNumber: 1,
      createdAt: 1,
      ambulanceId: 1,
    },
  ).lean();

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

  const prevDiensts = await Dienst.find({
    weekStartDate: { $gte: prevWeekStart, $lt: prevWeekNextDay },
  }).lean();

  const hasPreviousWeek = prevDiensts.length > 0;

  const dienstToTeam = new Map<number, (typeof teams)[0]>();

  for (const num of dienstNumbers) {
    if (fixedMap.has(num)) {
      dienstToTeam.set(num, fixedMap.get(num)!);
    }
  }

  if (!hasPreviousWeek) {
    console.log("📌 Semana base: no se auto-asignan equipos rotativos.");
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

      const driverId = assignedTeam?.driver as
        | mongoose.Types.ObjectId
        | undefined;
      const medicId = assignedTeam?.medic as
        | mongoose.Types.ObjectId
        | undefined;

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
        driverId: driverId?.toString(),
        medicId: medicId?.toString(),
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

        if (driverId && !block.driver) {
          baseAssignment.driver = driverId;
        }

        if (medicId && !block.medic) {
          baseAssignment.medic = medicId;
        }

        if (teamAmbulanceId) {
          baseAssignment.ambulanceId = teamAmbulanceId;
        }

        assignments.push(baseAssignment);
      }

      return {
        dienstNumber,
        weekStartDate: startDate,
        weekEndDate: endDate,
        assignments,
        weekTeamId: assignedTeam
          ? new mongoose.Types.ObjectId(String((assignedTeam as any)._id))
          : null,
      };
    }),
  );

  await Dienst.insertMany(dienstsToInsert);

  return { count: dienstsToInsert.length };
}
