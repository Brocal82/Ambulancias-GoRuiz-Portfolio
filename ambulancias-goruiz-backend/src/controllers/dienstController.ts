//src/controllers/dienstController.ts
import { Request, Response } from "express";
import Dienst from "../models/Dienst";
import {
  DienstTemplate,
  type DaySchedule,
} from "../modules/dienst-templates/models";
import Ambulance from "../models/Ambulance"; // ✅ Nuevo import
import { dienstSchema } from "../schemas/dienstSchema";
import { dienstQuerySchema } from "../schemas/dienstQuerySchema";
import { ZodError, z } from "zod";
import mongoose from "mongoose";
import { RequestHandler } from "express";
import { AssignedDay } from "../types/Dienst";
import Team from "../models/Team";
import User from "../models/User";
import { getPscheinStatus } from "../utils/pscheinUtils";
import {
  findWeeklyConflicts,
  getDriverPscheinState,
  isOnVacationDay,
  isOnSickDay,
} from "../utils/dienstValidation";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID no válido",
});

export const createDienst = async (req: Request, res: Response) => {
  try {
    const parsedData = dienstSchema.parse(req.body);
    const newDienst = new Dienst(parsedData);
    const savedDienst = await newDienst.save();
    res.status(201).json(savedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al crear Dienst", error });
    }
  }
};

export const getAllDiensts: RequestHandler = async (req, res) => {
  try {
    const diensts = await Dienst.find()
      .populate(
        "assignments.driver",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.medic",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.ambulanceId",
        "ambulanceNumber brand modelName licensePlate",
      )
      .lean(); // 👈 opcional pero recomendable para front
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener los Diensts:", error);
    res.status(500).json({ message: "Error al obtener los Diensts" });
  }
};

export const getDienstById = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const dienst = await Dienst.findById(parsedId).populate(
      "assignments.driver assignments.medic assignments.ambulanceId",
    );
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json(dienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "ID inválido", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al obtener el Dienst", error });
    }
  }
};

export const updateDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const parsedData = dienstSchema.partial().parse(req.body);
    const updatedDienst = await Dienst.findByIdAndUpdate(parsedId, parsedData, {
      new: true,
    }).populate("assignments.driver assignments.medic assignments.ambulanceId");
    if (!updatedDienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json(updatedDienst);
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al actualizar el Dienst", error });
    }
  }
};

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments)) {
    res
      .status(400)
      .json({ message: "No se proporcionaron assignments válidos." });
    return;
  }

  try {
    const dienst = await Dienst.findById(id);
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }

    for (const incoming of assignments) {
      // Copia mutable
      const updatedCopy: any = { ...incoming };

      // Normalización campos vacíos a undefined
      if (updatedCopy?._id === "") delete updatedCopy._id;
      if (updatedCopy?.driver === "") updatedCopy.driver = undefined;
      if (updatedCopy?.medic === "") updatedCopy.medic = undefined;
      // 🚦 Importante: NO tocar ambulanceId aquí; se gestiona más abajo según venga o no venga

// ✅ Validación de obligatorios (ambulancia NO es obligatoria)
// Reglas: date, startTime, endTime SIEMPRE.
// driver/medic pueden quedar vacíos (permitir "Sin asignar").
const missingRequired =
  !updatedCopy?.date || !updatedCopy?.startTime || !updatedCopy?.endTime;

if (missingRequired) {
  console.warn("Assignment incompleto ignorado (faltan obligatorios):", {
    date: updatedCopy?.date,
    startTime: updatedCopy?.startTime,
    endTime: updatedCopy?.endTime,
  });
  continue;
}


      // Buscar por fecha (tu lógica actual usa la fecha como clave)
      const idx = dienst.assignments.findIndex(
        (a: any) => a.date === updatedCopy.date,
      );

      // ¿El payload trae explícitamente el campo ambulanceId?
      const hasAmbulanceField = Object.prototype.hasOwnProperty.call(
        incoming,
        "ambulanceId",
      );

      if (idx !== -1) {
        // 🔁 Merge seguro sobre un assignment existente
        const prev = dienst.assignments[idx];

        // Detectar qué campos de rol llegan explícitamente en el payload
        const hasDriverField = Object.prototype.hasOwnProperty.call(
          incoming,
          "driver",
        );
        const hasMedicField = Object.prototype.hasOwnProperty.call(
          incoming,
          "medic",
        );

        // Actualiza SIEMPRE fecha y horas
        prev.date = updatedCopy.date;
        prev.startTime = updatedCopy.startTime;
        prev.endTime = updatedCopy.endTime;

        // Roles: solo tocamos el que llegue en el payload
        if (hasDriverField) {
  const incomingDriver = (incoming as any).driver;

  if (incomingDriver === "" || incomingDriver === null) {
    // ✅ Borrado robusto
    // @ts-ignore
    prev.driver = null;
    // @ts-ignore
    if ("driver" in prev) {
      // @ts-ignore
      delete prev.driver;
    }
  } else {
    prev.driver = updatedCopy.driver;
  }
}

if (hasMedicField) {
  const incomingMedic = (incoming as any).medic;

  if (incomingMedic === "" || incomingMedic === null) {
    // ✅ Borrado robusto
    // @ts-ignore
    prev.medic = null;
    // @ts-ignore
    if ("medic" in prev) {
      // @ts-ignore
      delete prev.medic;
    }
  } else {
    prev.medic = updatedCopy.medic;
  }
}


        // Ambulancia:
        // - si VIENE en el payload:
        //    * string válida -> asignar
        //    * "" o null     -> borrar explícitamente (unset real)
        // - si NO viene     -> conservar la previa
        if (hasAmbulanceField) {
          const amb = (incoming as any).ambulanceId;

          if (amb === "" || amb === null) {
            // ✅ Borrado robusto: pon null y elimina la clave para asegurar persistencia
            // @ts-ignore
            prev.ambulanceId = null;
            // @ts-ignore
            if ("ambulanceId" in prev) {
              // eliminar la clave del subdocumento
              // @ts-ignore
              delete prev.ambulanceId;
            }
          } else if (amb !== undefined) {
            // asignación/actualización
            // @ts-ignore
            prev.ambulanceId = amb;
          }
        }

        dienst.assignments[idx] = prev as any;
      } else {
        // ➕ Nuevo assignment: crear con obligatorios, permitiendo UNO solo de los roles
        const toInsert: any = {
          date: updatedCopy.date,
          startTime: updatedCopy.startTime,
          endTime: updatedCopy.endTime,
        };

        // Incluir SOLO los roles que TRAEN valor
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

        // Ambulancia solo si VIENE en el payload y no es ""/null
        if (hasAmbulanceField) {
          const amb = (incoming as any).ambulanceId;
          if (amb && amb !== "" && amb !== null) {
            toInsert.ambulanceId = amb;
          }
          // si llega ""/null => se omite, queda sin ambulancia
        }

        dienst.assignments.push(toInsert);
      }
    }

    await dienst.save();

    // Popular para respuesta coherente con el front
    const populated = await Dienst.findById(id)
      .populate(
        "assignments.driver",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.medic",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.ambulanceId",
        "ambulanceNumber brand modelName licensePlate",
      );

    res.json(populated ?? dienst);
  } catch (error) {
    console.error("Error al actualizar Dienst:", error);
    res.status(500).json({ message: "Error al actualizar Dienst" });
  }
};

export const deleteDienst = async (req: Request, res: Response) => {
  try {
    const parsedId = idSchema.parse(req.params.id);
    const deletedDienst = await Dienst.findByIdAndDelete(parsedId);
    if (!deletedDienst) {
      res.status(404).json({ message: "Dienst no encontrado" });
      return;
    }
    res.status(200).json({ message: "Dienst eliminado correctamente" });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "ID inválido", errors: error.errors });
    } else {
      res.status(500).json({ message: "Error al eliminar el Dienst", error });
    }
  }
};

export const searchDienst = async (req: Request, res: Response) => {
  try {
    const parsedQuery = dienstQuerySchema.parse(req.query);
    const query: any = {};

    if (parsedQuery.dienstNumber) {
      const num = parseInt(parsedQuery.dienstNumber, 10);
      if (!isNaN(num)) query.dienstNumber = num;
    }

    if (parsedQuery.weekStartDate) {
      query.weekStartDate = parsedQuery.weekStartDate;
    }

    if (parsedQuery.date) {
      query["assignments.date"] = parsedQuery.date;
    }

    if (parsedQuery.driver) {
      query["assignments.driver"] = parsedQuery.driver;
    }

    if (parsedQuery.medic) {
      query["assignments.medic"] = parsedQuery.medic;
    }

    const dienste = await Dienst.find(query).populate(
      "assignments.driver assignments.medic",
    );
    res.status(200).json(dienste);
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: "Parámetros inválidos", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Error al buscar Diensts", error });
    return;
  }
};

export const getDienstsByUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const diensts = await Dienst.find({
      assignments: {
        $elemMatch: {
          $or: [
            { driver: new mongoose.Types.ObjectId(userId) },
            { medic: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
    })
      .populate("assignments.driver", "name lastName")
      .populate("assignments.medic", "name lastName");

    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error fetching diensts:", error);
    res.status(500).json({ message: "Error fetching diensts", error });
  }
};

export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ message: "ID de usuario no válido" });
    return;
  }

  try {
    const diensts = await Dienst.find({
      $or: [
        { "assignments.driver": new mongoose.Types.ObjectId(userId) },
        { "assignments.medic": new mongoose.Types.ObjectId(userId) },
      ],
    })
      .populate("assignments.driver", "name lastName pscheinExpiry")
      .populate("assignments.medic", "name lastName pscheinExpiry")
      .populate("assignments.ambulanceId", "ambulanceNumber") // puede venir null
      .lean();

    const assignedDays: AssignedDay[] = [];

    diensts.forEach((dienst) => {
      dienst.assignments.forEach((assignment: any) => {
        // saltar si este assignment no corresponde al usuario
        const isDriver = assignment?.driver?._id?.toString() === userId;
        const isMedic = assignment?.medic?._id?.toString() === userId;
        if (!isDriver && !isMedic) return;

        const ambulanceData = assignment?.ambulanceId ?? null;

        const ambulanceId =
          ambulanceData && typeof ambulanceData === "object"
            ? ambulanceData._id?.toString()
            : typeof ambulanceData === "string"
              ? ambulanceData
              : undefined;

        const ambulanceNumber =
          ambulanceData && typeof ambulanceData === "object"
            ? ambulanceData.ambulanceNumber
            : undefined;

        assignedDays.push({
          dienstId: dienst._id.toString(),
          dienstNumber: dienst.dienstNumber,
          assignmentId: assignment?._id?.toString(),
          date: assignment?.date,
          startTime: assignment?.startTime,
          endTime: assignment?.endTime,
          ambulanceId,
          ambulanceNumber,
          driver: assignment?.driver?._id
            ? {
                _id: assignment.driver._id.toString(),
                name: assignment.driver.name,
                lastName: assignment.driver.lastName,
                pscheinExpiry: assignment.driver.pscheinExpiry,
              }
            : assignment?.driver || null,
          medic: assignment?.medic?._id
            ? {
                _id: assignment.medic._id.toString(),
                name: assignment.medic.name,
                lastName: assignment.medic.lastName,
                pscheinExpiry: assignment.medic.pscheinExpiry,
              }
            : assignment?.medic || null,
        });
      });
    });

    res.status(200).json(assignedDays);
  } catch (error) {
    console.error("❌ Error al obtener días asignados:", error);
    res.status(500).json({ message: "Error al obtener días asignados" });
  }
};

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
        const dayBlockMap: Record<string, { driver: boolean; medic: boolean }> =
          {};

        for (let j = 0; j < 7; j++) {
          const day = new Date(startDate);
          day.setDate(startDate.getDate() + j);
          const dateISO = day.toISOString().split("T")[0];

          if (driverId || medicId) {
            const [drvVac, medVac, drvSick, medSick] = await Promise.all([
              driverId
                ? isOnVacationDay({ userId: driverId.toString(), dateISO })
                : Promise.resolve(false),
              medicId
                ? isOnVacationDay({ userId: medicId.toString(), dateISO })
                : Promise.resolve(false),
              driverId
                ? isOnSickDay({ userId: driverId.toString(), dateISO })
                : Promise.resolve(false),
              medicId
                ? isOnSickDay({ userId: medicId.toString(), dateISO })
                : Promise.resolve(false),
            ]);

            dayBlockMap[dateISO] = {
              driver: Boolean(drvVac || drvSick),
              medic: Boolean(medVac || medSick),
            };
          } else {
            dayBlockMap[dateISO] = { driver: false, medic: false };
          }
        }

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

export const deleteDienstsForWeek: RequestHandler = async (req, res) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const deleted = await Dienst.deleteMany({
      weekStartDate: {
        $gte: start,
        $lte: end,
      },
    });

    res
      .status(200)
      .json({ message: "Diensts eliminados", count: deleted.deletedCount });
  } catch (error) {
    console.error("Error al eliminar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const removeAssignment = async (req: Request, res: Response) => {
  const { date } = req.body;
  const parsedId = idSchema.parse(req.params.id);

  try {
    const updatedDienst = await Dienst.findByIdAndUpdate(
      parsedId,
      { $pull: { assignments: { date } } },
      { new: true },
    )
      .populate("assignments.driver", "name lastName pscheinExpiry")
      .populate("assignments.medic", "name lastName pscheinExpiry")
      .populate(
        "assignments.ambulanceId",
        "ambulanceNumber brand modelName licensePlate",
      );

    res.status(200).json(updatedDienst);
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el assignment", error });
  }
};

// ✅ Asignar TEAM a la semana:
//    - Si hay CUALQUIER conflicto semanal (driver o medic en otro Dienst): ABORTAR (409).
//    - Vacaciones: seguir aplicando de forma parcial por día/rol.
//    - Excepción P-Schein driver caducado si driver=both y el compañero puede conducir.
//    - Si el front envía resolvedRoles (driverId/medicId), los usamos (por ejemplo, tras un swap seguro).
export const assignTeamToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, teamId, resolvedRoles } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string;
      teamId?: string;
      resolvedRoles?: {
        driverId?: string;
        medicId?: string;
      };
    };

    if (!dienstNumber || !weekStartDate || !teamId) {
      res
        .status(400)
        .json({
          message: "Faltan parámetros: dienstNumber, weekStartDate, teamId",
        });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      res.status(400).json({ message: "teamId inválido" });
      return;
    }

    const team = await Team.findById(teamId)
      .populate("driver", "pscheinExpiry ambulanceRole")
      .populate("medic", "pscheinExpiry ambulanceRole")
      .lean();

    if (!team) {
      res.status(404).json({ message: "Team no encontrado" });
      return;
    }

    const toIdString = (v: any): string | undefined =>
      typeof v === "string"
        ? v
        : v && typeof v === "object" && v._id
          ? String(v._id)
          : undefined;

    const teamDriverId = toIdString((team as any).driver);
    const teamMedicId = toIdString((team as any).medic);

    if (!teamDriverId || !teamMedicId) {
      res.status(400).json({ message: "Team inválido: faltan driver o medic" });
      return;
    }

    // 🚑 Ambulancia fija del team (opcional)
    const teamAmbulanceId: mongoose.Types.ObjectId | null = (team as any)
      .ambulanceId
      ? new mongoose.Types.ObjectId(String((team as any).ambulanceId))
      : null;

    // 🔀 Aplicar resolvedRoles si vienen del front (ej. swap pre-calculado en el modal)
    let driverId = teamDriverId;
    let medicId = teamMedicId;

    if (resolvedRoles && (resolvedRoles.driverId || resolvedRoles.medicId)) {
      const rDriverId = resolvedRoles.driverId;
      const rMedicId = resolvedRoles.medicId;

      if (!rDriverId || !rMedicId) {
        res.status(400).json({
          message:
            "resolvedRoles incompletos: deben incluir driverId y medicId",
        });
        return;
      }

      // Deben ser exactamente los dos miembros del team y no pueden ser el mismo
      const validIds = new Set([teamDriverId, teamMedicId]);
      if (
        !validIds.has(rDriverId) ||
        !validIds.has(rMedicId) ||
        rDriverId === rMedicId
      ) {
        res.status(400).json({
          message: "resolvedRoles inválidos para este team",
        });
        return;
      }

      driverId = rDriverId;
      medicId = rMedicId;
    }

    // 🔍 Elegir qué doc es driverDoc y cuál es medicDoc según los IDs finales
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
      res.status(400).json({
        message:
          "No se pudieron resolver correctamente driverDoc/medicDoc para el team",
      });
      return;
    }

    const driverRole = driverDoc?.ambulanceRole as
      | "driver"
      | "medic"
      | "both"
      | undefined;
    const medicRole = medicDoc?.ambulanceRole as
      | "driver"
      | "medic"
      | "both"
      | undefined;

    const driverPschein = getDriverPscheinState(driverDoc?.pscheinExpiry);
    const medicPschein = getDriverPscheinState(medicDoc?.pscheinExpiry);

    const medicCanDrive =
      (medicRole === "driver" || medicRole === "both") &&
      (medicPschein === "valid" || medicPschein === "warning");
    const driverIsBoth = driverRole === "both";

    let driverExpiredButBothHint = false;

    // ⛔ Validación P-Schein del CONDUCTOR final
    if (driverPschein === "expired") {
      if (driverIsBoth && medicCanDrive) {
        // Permitimos excepción, pero avisamos al front para que considere swap de roles
        driverExpiredButBothHint = true;
      } else {
        res.status(409).json({
          code: "pschein_expired",
          message:
            "El P-Schein del conductor está caducado. No se puede asignar el equipo.",
        });
        return;
      }
    }

    // Semana/Dienst
    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: {
        $gte: start,
        $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    if (!dienst) {
      res
        .status(404)
        .json({ message: "No existe Dienst para esa semana y número" });
      return;
    }

    // 🔒 CONFLICTOS SEMANALES (BLOQUEAMOS SI HAY CUALQUIERA)
    const [driverConf, medicConf] = await Promise.all([
      findWeeklyConflicts(
        new mongoose.Types.ObjectId(driverId),
        start,
        dienstNumber,
      ),
      findWeeklyConflicts(
        new mongoose.Types.ObjectId(medicId),
        start,
        dienstNumber,
      ),
    ]);

    if ((driverConf?.length ?? 0) > 0 || (medicConf?.length ?? 0) > 0) {
      res.status(409).json({
        code: "weekly_conflict",
        message:
          "Alguno de los miembros ya está asignado a otro Dienst esta semana.",
        details: { driverConf, medicConf },
      });
      return; // 🚫 no asignamos NADA
    }

    // ✅ Si NO hay conflictos, aplicamos (parcial solo por vacaciones)
    const dates = Array.from(
      new Set(
        (dienst.assignments || [])
          .filter((a) => a?.date && a?.startTime && a?.endTime)
          .map((a) => a.date),
      ),
    );

    // 🩺 Bloqueos por día: vacaciones o baja (sick)
    const dayBlockMap: Record<string, { driver: boolean; medic: boolean }> = {};
    await Promise.all(
      dates.map(async (dateISO) => {
        const [drvVac, medVac, drvSick, medSick] = await Promise.all([
          isOnVacationDay({ userId: driverId, dateISO }),
          isOnVacationDay({ userId: medicId, dateISO }),
          isOnSickDay({ userId: driverId, dateISO }),
          isOnSickDay({ userId: medicId, dateISO }),
        ]);

        dayBlockMap[dateISO] = {
          driver: Boolean(drvVac || drvSick),
          medic: Boolean(medVac || medSick),
        };
      }),
    );

    let updatedCount = 0;
    // mantenemos el mismo array por compatibilidad con el front
    const skippedByVacation: Array<{ date: string; role: "driver" | "medic" }> =
      [];

    dienst.assignments = (dienst.assignments || []).map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      const dateISO = a.date;
      const block = dayBlockMap[dateISO] || { driver: false, medic: false };

      let next = { ...a } as any;
      let changed = false;

      // 🚗 Asignar conductor si no está bloqueado
      if (!block.driver) {
        const newId = new mongoose.Types.ObjectId(driverId);
        if (!next.driver || String(next.driver) !== String(newId)) {
          next.driver = newId;
          changed = true;
        }
      } else {
        skippedByVacation.push({ date: dateISO, role: "driver" });
      }

      // 🧑‍⚕️ Asignar sanitario si no está bloqueado
      if (!block.medic) {
        const newId = new mongoose.Types.ObjectId(medicId);
        if (!next.medic || String(next.medic) !== String(newId)) {
          next.medic = newId;
          changed = true;
        }
      } else {
        skippedByVacation.push({ date: dateISO, role: "medic" });
      }

      // 🚑 Ambulancia fija del team (sin pisar manual)
      if (teamAmbulanceId && !next.ambulanceId) {
        next.ambulanceId = teamAmbulanceId;
        changed = true;
      }

      if (changed) updatedCount += 1;
      return next;
    });

    // ✅ Guardar ancla semanal del Team para rotación futura (robusto aunque haya sick/vac)
    (dienst as any).weekTeamId = new mongoose.Types.ObjectId(teamId);

    await dienst.save();

    res.status(200).json({
      message: `Team asignado a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      dienstId: dienst.id,
      weekStartDate,
      hints: { driverExpiredButBoth: !!driverExpiredButBothHint },
    });
  } catch (error) {
    console.error("❌ Error en assignTeamToWeek:", error);
    res.status(500).json({ message: "Error al asignar el Team a la semana" });
  }
};

// ✅ Asignar UN USUARIO (driver o medic) a TODA la semana de un Dienst
export const assignUserToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, userId, role } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
      userId?: string;
      role?: "driver" | "medic";
    };

    if (!dienstNumber || !weekStartDate || !userId || !role) {
      res
        .status(400)
        .json({
          message:
            "Faltan parámetros: dienstNumber, weekStartDate, userId, role",
        });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: "userId inválido" });
      return;
    }

    if (role !== "driver" && role !== "medic") {
      res
        .status(400)
        .json({ message: 'Rol inválido. Debe ser "driver" o "medic"' });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    // 🚦 Si es driver, validar P-Schein
    if (role === "driver") {
      const User = mongoose.model("User");
      const u = await User.findById(userId).select("pscheinExpiry").lean();
      if (!u) {
        res.status(404).json({ message: "Usuario no encontrado" });
        return;
      }
      const ps = getDriverPscheinState((u as any)?.pscheinExpiry);
      if (ps === "expired") {
        res.status(409).json({
          code: "pschein_expired",
          message:
            "El P-Schein del conductor está caducado. No se puede asignar.",
        });
        return;
      }
    }

    // 🚧 Conflictos semanales (cualquier Dienst de esa misma semana)
    const weeklyConf = await findWeeklyConflicts(
      new mongoose.Types.ObjectId(userId),
      start,
      dienstNumber,
    );
    if (weeklyConf.length > 0) {
      res.status(409).json({
        code: "weekly_conflict",
        message: "Este usuario ya está asignado a otro Dienst esta semana.",
        details: weeklyConf,
      });
      return;
    }

    // 🔍 Buscar el Dienst de esa semana y número
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: nextDay },
    });

    if (!dienst) {
      res
        .status(404)
        .json({ message: "No existe Dienst para esa semana y número" });
      return;
    }

    // 📅 Días válidos (tienen date/start/end)
    const dates = Array.from(
      new Set(
        (dienst.assignments || [])
          .filter((a) => a?.date && a?.startTime && a?.endTime)
          .map((a) => a.date),
      ),
    );

    // 🗓️ Mapas separados para distinguir vacaciones vs baja
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

        return a; // saltar este día
      }

      updatedCount += 1;
      return {
        ...a,
        [role]: new mongoose.Types.ObjectId(userId),
      } as any;
    });

    // ⚠️ Si no se pudo asignar ningún día
    if (updatedCount === 0) {
      const onlySickBlocks =
        skippedBreakdown.sick > 0 &&
        skippedBreakdown.vacation === 0 &&
        skippedBreakdown.both === 0;

      res.status(409).json({
        code: onlySickBlocks ? "no_assignable_days_sick" : "no_assignable_days",
        message: onlySickBlocks
          ? "No se pudo asignar ningún día por baja médica."
          : "No se pudo asignar ningún día (vacaciones u otros filtros).",
        skippedByVacation,
        skippedBreakdown,
      });
      return;
    }

    await dienst.save();

    res.status(200).json({
      message: `Usuario asignado como ${role} a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      skippedBreakdown, // opcional para diagnóstico
      dienstId: dienst.id,
      weekStartDate,
      role,
      userId,
    });
  } catch (error) {
    console.error("❌ Error en assignUserToWeek:", error);
    res
      .status(500)
      .json({ message: "Error al asignar el usuario a la semana" });
  }
};

// ✅ Limpiar driver/medic/ambulancia de TODA la semana del Dienst (mantiene horas)
export const clearPeopleForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
    };

    if (!dienstNumber || !weekStartDate) {
      res
        .status(400)
        .json({ message: "Faltan parámetros: dienstNumber, weekStartDate" });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    // Buscar Dienst por número y día exacto de inicio de semana
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: {
        $gte: start,
        $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (!dienst) {
      res
        .status(404)
        .json({ message: "No existe Dienst para esa semana y número" });
      return;
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
        ambulanceId: undefined, // 👈 ahora también se limpia la ambulancia
      } as any;
    });

    // ✅ Al limpiar personas, también limpiamos el ancla semanal
    (dienst as any).weekTeamId = null;

    await dienst.save();

    res.status(200).json({
      message: `Asignaciones (driver/medic/ambulancia) limpiadas para Dienst #${dienstNumber} (${weekStartDate}).`,
      clearedCount,
      dienstId: dienst.id,
      weekStartDate,
    });
  } catch (error) {
    console.error("❌ Error en clearPeopleForWeek:", error);
    res
      .status(500)
      .json({ message: "Error al limpiar asignaciones de la semana" });
  }
};
