//src/controllers/dienstController.ts
import { Request, Response } from "express";
import Dienst from "../models/Dienst";
import {
  DienstTemplate,
  type DaySchedule,
} from "../modules/dienst-templates/models";
import Ambulance from "../models/Ambulance"; // ✅ Nuevo import
import mongoose from "mongoose";
import { RequestHandler } from "express";
import Team from "../models/Team";
import {
  computeDayBlockMapForTeam,
  findWeeklyConflicts,
  getDriverPscheinState,
  isOnVacationDay,
  isOnSickDay,
} from "../utils/dienstValidation";
import { extractValidDatesFromAssignments } from "../utils/dienstMappers";

// 🗓️ Calcula un índice de semana estable a partir de una fecha (para rotar equipos entre semanas)
function getWeekIndexFromDate(date: Date): number {
  // Normalizamos la fecha a medianoche UTC para evitar líos de zona horaria
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  // Fecha base arbitraria pero fija (1 enero 2024)
  const base = Date.UTC(2024, 0, 1);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((utc - base) / msPerDay);

  // Índice de semana (puede ser negativo si la fecha es anterior a la base, pero nos sirve igualmente)
  return Math.floor(diffDays / 7);
}

export const generateDienstTemplatesForWeek: RequestHandler = async (
  req,
  res,
) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const startDate = new Date(weekStartDate);
    if (isNaN(startDate.getTime())) {
      res.status(400).json({ message: "Fecha de inicio inválida" });
      return;
    }

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // ❌ Si ya hay Diensts en esa semana, no generamos nada
    const existing = await Dienst.find({
      weekStartDate: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    if (existing.length > 0) {
      res.status(400).json({ message: "Ya existen Diensts para esa semana" });
      return;
    }

    // 📄 Leer plantillas activas desde BD
    const templates = await DienstTemplate.find({ isActive: true })
      .sort({ dienstNumber: 1 })
      .lean();

    if (!templates || templates.length === 0) {
      res.status(400).json({
        message:
          "No hay plantillas de Dienst activas. Crea al menos una antes de generar la semana.",
      });
      return;
    }

    // 🔢 Números de Dienst a partir de plantillas
    const dienstNumbers = templates.map((tpl) => tpl.dienstNumber);

    // 👥 Traer equipos con su configuración de rotación
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

    // 🗺️ Mapas de ayuda: fijos y rotativos
    const fixedMap = new Map<number, (typeof teams)[0]>();
    const rotatingTeams: (typeof teams)[0][] = [];

    for (const team of teams) {
      const mode = (team as any).rotationMode ?? "rotating";
      const fixedNum = (team as any).fixedDienstNumber as
        | number
        | null
        | undefined;

      if (mode === "fixed" && fixedNum && dienstNumbers.includes(fixedNum)) {
        fixedMap.set(fixedNum, team);
      } else if (mode === "rotating") {
        rotatingTeams.push(team);
      }
    }

    // 🔍 Determinar si existe semana anterior (buscamos por el lunes exacto anterior)
    // Normalizamos para evitar líos de horas/UTC.
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

    // 🗺️ Resultado final
    const dienstToTeam = new Map<number, (typeof teams)[0]>();

    // 1️⃣ Asignar equipos FIJOS SIEMPRE
    for (const num of dienstNumbers) {
      if (fixedMap.has(num)) {
        dienstToTeam.set(num, fixedMap.get(num)!);
      }
    }

    // 🚫 SI NO HAY SEMANA ANTERIOR → SEMANA BASE
    // Solo se asignan equipos fijos. No se asigna ningún rotativo.
    if (!hasPreviousWeek) {
      console.log("📌 Semana base: no se auto-asignan equipos rotativos.");
    } else {
      // 🟢 Semana con anterior → rotación basada en el ancla (weekTeamId)
      const freeDienstNumbers = dienstNumbers
        .filter((num) => !fixedMap.has(num))
        .sort((a, b) => a - b);

      const freeCount = freeDienstNumbers.length;

      if (freeCount > 0 && rotatingTeams.length > 0) {
        // Index por teamId (solo rotativos)
        const teamById = new Map<string, (typeof teams)[0]>();
        for (const t of rotatingTeams) teamById.set(String((t as any)._id), t);

        // Mapa de anclas de la semana anterior: dienstNumber -> team
        const prevAnchorsByDienst = new Map<number, (typeof teams)[0]>();

        // 1) Principal: usar weekTeamId (robusto aunque haya sick/vac)
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

        // 2) Fallback: para semanas viejas sin weekTeamId, deducimos por assignments (match suave)
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

              // ✅ Match suave: cuenta si coincide driver O medic en algún día
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

        // 3) Rotación circular SOLO para slots que tenían ancla (no inventamos teams)
        const usedTargets = new Set<number>();

        for (let i = 0; i < freeCount; i++) {
          const fromDienst = freeDienstNumbers[i];
          const team = prevAnchorsByDienst.get(fromDienst);
          if (!team) continue;

          let newIndex = (i + 1) % freeCount;

          // evitar colisiones con otros rotativos o con algo ya asignado
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

    // 👉 El resto de Diensts libres quedan sin equipo, igual que antes (asignación manual).

    // 🧱 Crear los Diensts usando las plantillas (horario + días libres / por día)
    const dienstsToInsert = await Promise.all(
      templates.map(async (tpl: any) => {
        const dienstNumber = tpl.dienstNumber;
        const templateStartTime = tpl.startTime;
        const templateEndTime = tpl.endTime;
        const daysOff = Array.isArray(tpl.daysOff) ? tpl.daysOff : [];
        const daysOffSet = new Set<number>(daysOff);

        // 👇 Nuevo: horario por día, si existe
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

        // 🚑 Ambulancia fija del equipo (si existe)
        const teamAmbulanceId =
          assignedTeam && (assignedTeam as any).ambulanceId
            ? new mongoose.Types.ObjectId(
                String((assignedTeam as any).ambulanceId),
              )
            : undefined;

        // Pre-calculamos por día si driver/medic están bloqueados por vacaciones/baja
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

          const weekDayIndex = day.getDay(); // 0=domingo, ..., 6=sábado

          let startTimeForDay: string;
          let endTimeForDay: string;

          if (usePerDaySchedule) {
            // 🗓️ Modo nuevo: usar perDaySchedule si está definido
            const dayCfg = perDaySchedule!.find(
              (d) => d.dayIndex === weekDayIndex,
            );

            if (dayCfg && dayCfg.isOff) {
              // Día marcado como libre en perDaySchedule → se salta
              continue;
            }

            // Si no hay configuración específica para ese día,
            // o si falta start/end, usamos el horario global como fallback.
            startTimeForDay = (dayCfg && dayCfg.startTime) || templateStartTime;
            endTimeForDay = (dayCfg && dayCfg.endTime) || templateEndTime;
          } else {
            // 🕒 Modo viejo: usar daysOff + horario global
            if (daysOffSet.has(weekDayIndex)) {
              // Día libre según daysOff
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

          // 🚗 Asignar conductor si hay equipo y no está de vacaciones/baja
          if (driverId && !block.driver) {
            baseAssignment.driver = driverId;
          }

          // 🧑‍⚕️ Asignar sanitario si hay equipo y no está de vacaciones/baja
          if (medicId && !block.medic) {
            baseAssignment.medic = medicId;
          }

          // 🚑 Asignar ambulancia fija del equipo (si tiene)
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

          // ✅ Guardamos el ancla del Team para rotación futura
          weekTeamId: assignedTeam
            ? new mongoose.Types.ObjectId(String((assignedTeam as any)._id))
            : null,
        };
      }),
    );

    await Dienst.insertMany(dienstsToInsert);

    res.status(201).json({
      message:
        "Diensts generados correctamente a partir de plantillas, con rotación de equipos aplicada (fijos, rotativos, vacaciones y bajas, respetando horarios por día si existen).",
      count: dienstsToInsert.length,
    });
  } catch (error) {
    console.error("❌ Error al generar Diensts:", error);
    res.status(500).json({ message: "Error al generar Diensts" });
  }
};
