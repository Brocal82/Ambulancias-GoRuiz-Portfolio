// src/controllers/teamController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Team from "../models/Team";
import User from "../models/User";
import Dienst from "../models/Dienst";
import VacationRequest from "../models/vacationRequest";
import { DateTime } from "luxon";
import { isOnVacationDay } from "../utils/dienstValidation";
import { computeTeamAssignmentsForWeek } from "../utils/teamRotation";
import Ambulance from "../models/Ambulance";

const ZONE = "Europe/Berlin";

const isObjectId = (s: unknown) =>
  typeof s === "string" && mongoose.Types.ObjectId.isValid(s);

// 👉 Helper: devuelve si está de vacaciones HOY y hasta cuándo
async function getTodayVacationInfo(
  userId?: mongoose.Types.ObjectId | string | null,
) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return {
      isOnVacation: false as const,
      vacationUntil: undefined as string | undefined,
    };
  }

  const now = DateTime.now().setZone(ZONE);
  const startOfToday = now.startOf("day").toJSDate();
  const endOfToday = now.endOf("day").toJSDate();

  const vac = await VacationRequest.findOne({
    user: userId,
    status: "accepted",
    startDate: { $lte: endOfToday },
    endDate: { $gte: startOfToday },
  })
    .select("endDate")
    .lean();

  if (!vac) {
    return { isOnVacation: false as const, vacationUntil: undefined };
  }

  return {
    isOnVacation: true as const,
    vacationUntil: new Date(vac.endDate).toISOString(),
  };
}

export const listTeams = async (_req: Request, res: Response) => {
  try {
    const teams = await Team.find()
      .populate("driver", "name lastName ambulanceRole pscheinExpiry")
      .populate("medic", "name lastName ambulanceRole pscheinExpiry")
      .populate("ambulanceId", "ambulanceNumber brand modelName licensePlate") // 👈 NUEVO
      .lean();

    // ⏰ Fecha de hoy (ISO) en zona Berlin (corrige DST/off-by-one)
    const todayISO = DateTime.now().setZone(ZONE).toISODate()!;

    // Añadimos flags de vacaciones (hoy) y 'vacationUntil' sin romper el shape existente
    await Promise.all(
      teams.map(async (t: any) => {
        if (t?.driver?._id) {
          // bandera actual (reutiliza tu util)
          t.driver.isOnVacation = await isOnVacationDay({
            userId: String(t.driver._id),
            dateISO: todayISO,
          });
          // fecha 'hasta' (solo si está de vacaciones hoy)
          if (t.driver.isOnVacation) {
            const info = await getTodayVacationInfo(t.driver._id);
            t.driver.vacationUntil = info.vacationUntil;
          }
        }
        if (t?.medic?._id) {
          t.medic.isOnVacation = await isOnVacationDay({
            userId: String(t.medic._id),
            dateISO: todayISO,
          });
          if (t.medic.isOnVacation) {
            const info = await getTodayVacationInfo(t.medic._id);
            t.medic.vacationUntil = info.vacationUntil;
          }
        }
      }),
    );

    res.status(200).json(teams);
  } catch (err) {
    console.error("❌ Error listTeams:", err);
    res.status(500).json({ message: "Error al listar teams" });
  }
};

export const createTeam = async (req: Request, res: Response) => {
  try {
    const {
      driver,
      medic,
      rotationMode,
      fixedDienstNumber,
      ambulanceId, // 👈 NUEVO
    } = req.body as {
      driver?: string;
      medic?: string;
      rotationMode?: "rotating" | "fixed" | "none";
      fixedDienstNumber?: number | string | null;
      ambulanceId?: string | null;
    };

    // ✅ Validaciones básicas de IDs
    if (!isObjectId(driver) || !isObjectId(medic)) {
      res
        .status(400)
        .json({ message: "driver y medic deben ser ObjectId válidos" });
      return;
    }
    if (driver === medic) {
      res
        .status(400)
        .json({ message: "driver y medic no pueden ser la misma persona" });
      return;
    }

    // ✅ Si viene ambulancia, validar ID y existencia
    let normalizedAmbulanceId: string | null = null;
    if (ambulanceId) {
      if (!isObjectId(ambulanceId)) {
        res
          .status(400)
          .json({ message: "ambulanceId debe ser un ObjectId válido" });
        return;
      }
      const amb = await Ambulance.findById(ambulanceId).lean();
      if (!amb) {
        res.status(400).json({ message: "Ambulancia no encontrada" });
        return;
      }
      normalizedAmbulanceId = ambulanceId;
    }

    // ✅ Normalizar rotationMode con valor por defecto
    let normalizedRotation: "rotating" | "fixed" | "none" = "rotating";
    if (
      rotationMode === "fixed" ||
      rotationMode === "none" ||
      rotationMode === "rotating"
    ) {
      normalizedRotation = rotationMode;
    }

    // ✅ Normalizar fixedDienstNumber (solo tiene sentido si rotationMode === 'fixed')
    let normalizedFixedDienst: number | null = null;
    if (normalizedRotation === "fixed") {
      const num =
        typeof fixedDienstNumber === "string"
          ? Number(fixedDienstNumber)
          : fixedDienstNumber;

      if (!Number.isInteger(num) || num == null || num < 1) {
        res.status(400).json({
          message:
            'fixedDienstNumber debe ser un número entero ≥ 1 cuando rotationMode es "fixed"',
        });
        return;
      }

      normalizedFixedDienst = num;
    }

    // (opcional) verificar que existen y su rol
    const [driverUser, medicUser] = await Promise.all([
      User.findById(driver).lean(),
      User.findById(medic).lean(),
    ]);
    if (!driverUser || !medicUser) {
      res.status(400).json({ message: "Usuario driver o medic inexistente" });
      return;
    }

    // evitar duplicado exacto (además del índice único)
    const exists = await Team.findOne({ driver, medic }).lean();
    if (exists) {
      res.status(409).json({ message: "Ya existe un team con esa pareja" });
      return;
    }

    // 🚫 impedir que cualquiera de los dos ya pertenezca a otro team
    const [driverConflict, medicConflict] = await Promise.all([
      Team.findOne({ $or: [{ driver }, { medic: driver }] }).lean(),
      Team.findOne({ $or: [{ driver: medic }, { medic }] }).lean(),
    ]);

    if (driverConflict) {
      res.status(409).json({
        message:
          "El conductor seleccionado ya pertenece a un equipo. Elimínalo de su equipo actual antes de crear otro.",
      });
      return;
    }

    if (medicConflict) {
      res.status(409).json({
        message:
          "El sanitario seleccionado ya pertenece a un equipo. Elimínalo de su equipo actual antes de crear otro.",
      });
      return;
    }

    // ✅ Crear team con configuración de rotación + ambulancia fija (opcional)
    const team = await Team.create({
      driver,
      medic,
      rotationMode: normalizedRotation,
      fixedDienstNumber: normalizedFixedDienst,
      ambulanceId: normalizedAmbulanceId, // 👈 AQUÍ
    });

    const populated = await Team.findById(team._id)
      .populate("driver", "name lastName ambulanceRole pscheinExpiry")
      .populate("medic", "name lastName ambulanceRole pscheinExpiry")
      .populate("ambulanceId", "ambulanceNumber brand modelName licensePlate");

    res.status(201).json(populated);
  } catch (err: any) {
    console.error("❌ Error createTeam:", err);
    if (err?.code === 11000) {
      res
        .status(409)
        .json({ message: "Team duplicado (driver+medic ya existe)" });
      return;
    }
    res.status(500).json({ message: "Error al crear team" });
  }
};

// ✅ Preview de rotación de equipos para una semana (solo fija de momento)
export const previewTeamRotationForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { weekStartDate } = req.query as { weekStartDate?: string };

    if (!weekStartDate) {
      res
        .status(400)
        .json({ message: "Parámetro weekStartDate (YYYY-MM-DD) requerido" });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    // 🔎 Buscar los Diensts de esa semana y extraer sus números
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const dienste = await Dienst.find({
      weekStartDate: {
        $gte: start,
        $lte: end,
      },
    })
      .select("dienstNumber")
      .lean();

    const dienstNumbers = Array.from(
      new Set(
        dienste.map((d) => d.dienstNumber).filter((n) => typeof n === "number"),
      ),
    ).sort((a, b) => a - b);

    if (dienstNumbers.length === 0) {
      res.status(200).json({
        message: "No hay Diensts para esa semana, nada que rotar.",
        assignments: [],
      });
      return;
    }

    // 🔎 Cargar teams con info de rotación
    const teams = await Team.find(
      {},
      { rotationMode: 1, fixedDienstNumber: 1 },
    ).lean();

    const rotationInput = {
      dienstNumbers,
      teams: teams.map((t: any) => ({
        teamId: t._id as mongoose.Types.ObjectId, // 👈 casteamos para que cumpla WeekRotationInput
        rotationMode:
          (t.rotationMode as "rotating" | "fixed" | "none") ?? "rotating",
        fixedDienstNumber:
          typeof t.fixedDienstNumber === "number" ? t.fixedDienstNumber : null,
      })),
    };

    const result = computeTeamAssignmentsForWeek(rotationInput);

    res.status(200).json({
      message: "Preview de rotación calculado correctamente",
      dienstNumbers,
      assignments: result.assignments,
    });
  } catch (err) {
    console.error("❌ Error en previewTeamRotationForWeek:", err);
    res
      .status(500)
      .json({ message: "Error al calcular la rotación de equipos" });
  }
};

// 🔍 Devuelve los IDs de equipos que ya están usados en algún Dienst de esa semana
export const getUsedTeamsForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { weekStartDate } = req.query as { weekStartDate?: string };

    if (!weekStartDate) {
      res
        .status(400)
        .json({ message: "Parámetro weekStartDate requerido (YYYY-MM-DD)" });
      return;
    }

    const startDate = new Date(weekStartDate);
    if (isNaN(startDate.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    // Fin de la semana (incluyendo 6 días)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // 1️⃣ Traer todos los equipos (driver + medic)
    const teams = await Team.find({}, { driver: 1, medic: 1 }).lean();

    if (!teams || teams.length === 0) {
      res.status(200).json({ usedTeamIds: [] });
      return;
    }

    // Mapa driver+medic -> teamId
    const pairToTeamId = new Map<string, string>();
    for (const t of teams) {
      const dId = (t as any).driver?.toString?.();
      const mId = (t as any).medic?.toString?.();
      if (!dId || !mId) continue;

      const key = `${dId}::${mId}`;
      pairToTeamId.set(key, (t as any)._id.toString());
    }

    if (pairToTeamId.size === 0) {
      res.status(200).json({ usedTeamIds: [] });
      return;
    }

    // 2️⃣ Buscar Diensts de esa semana
    const diensts = await Dienst.find(
      {
        weekStartDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      { assignments: 1 },
    ).lean();

    if (!diensts || diensts.length === 0) {
      res.status(200).json({ usedTeamIds: [] });
      return;
    }

    // 3️⃣ Mirar cada assignment: si driver+medic coincide con un Team, lo marcamos como usado
    const usedTeamIds = new Set<string>();

    for (const d of diensts) {
      const assignments = (d as any).assignments ?? [];
      for (const a of assignments) {
        const drv = a?.driver?.toString?.();
        const med = a?.medic?.toString?.();
        if (!drv || !med) continue;

        const key = `${drv}::${med}`;
        const teamId = pairToTeamId.get(key);
        if (teamId) {
          usedTeamIds.add(teamId);
        }
      }
    }

    res.status(200).json({ usedTeamIds: Array.from(usedTeamIds) });
  } catch (err) {
    console.error("❌ Error en getUsedTeamsForWeek:", err);
    res
      .status(500)
      .json({ message: "Error al obtener equipos usados en la semana" });
  }
};

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      res.status(400).json({ message: "ID de team inválido" });
      return;
    }

    const { driver, medic, rotationMode, fixedDienstNumber, ambulanceId } =
      req.body as {
        driver?: string;
        medic?: string;
        rotationMode?: "rotating" | "fixed" | "none";
        fixedDienstNumber?: number | string | null;
        ambulanceId?: string | null;
      };

    // ✅ Comprobamos que vienen driver y medic (para este flujo de edición)
    if (!driver || !medic) {
      res.status(400).json({ message: "driver y medic son obligatorios" });
      return;
    }

    if (!isObjectId(driver) || !isObjectId(medic)) {
      res
        .status(400)
        .json({ message: "driver y medic deben ser ObjectId válidos" });
      return;
    }

    if (driver === medic) {
      res
        .status(400)
        .json({ message: "driver y medic no pueden ser la misma persona" });
      return;
    }

    // 🔁 Normalizar rotationMode
    let normalizedRotation: "rotating" | "fixed" | "none" = "rotating";
    if (
      rotationMode === "fixed" ||
      rotationMode === "none" ||
      rotationMode === "rotating"
    ) {
      normalizedRotation = rotationMode;
    }

    // 🔢 Normalizar fixedDienstNumber solo si rotationMode === 'fixed'
    let normalizedFixedDienst: number | null = null;
    if (normalizedRotation === "fixed") {
      const num =
        typeof fixedDienstNumber === "string"
          ? Number(fixedDienstNumber)
          : fixedDienstNumber;

      if (!Number.isInteger(num) || num == null || num < 1) {
        res.status(400).json({
          message:
            'fixedDienstNumber debe ser un número entero ≥ 1 cuando rotationMode es "fixed"',
        });
        return;
      }

      normalizedFixedDienst = num;
    }

    // 🔎 Verificar que usuarios existen
    const [driverUser, medicUser] = await Promise.all([
      User.findById(driver).lean(),
      User.findById(medic).lean(),
    ]);

    if (!driverUser || !medicUser) {
      res.status(400).json({ message: "Usuario driver o medic inexistente" });
      return;
    }

    // 🚫 Evitar duplicado exacto de pareja en OTRO team
    const duplicated = await Team.findOne({
      driver,
      medic,
      _id: { $ne: id },
    }).lean();

    if (duplicated) {
      res
        .status(409)
        .json({ message: "Ya existe otro team con esa pareja driver+medic" });
      return;
    }

    // 🚫 Evitar que alguno ya pertenezca a otro team distinto
    const [driverConflict, medicConflict] = await Promise.all([
      Team.findOne({
        _id: { $ne: id },
        $or: [{ driver }, { medic: driver }],
      }).lean(),
      Team.findOne({
        _id: { $ne: id },
        $or: [{ driver: medic }, { medic }],
      }).lean(),
    ]);

    if (driverConflict) {
      res.status(409).json({
        message:
          "El conductor seleccionado ya pertenece a otro equipo. Elimínalo de su equipo actual antes de asignarlo aquí.",
      });
      return;
    }

    if (medicConflict) {
      res.status(409).json({
        message:
          "El sanitario seleccionado ya pertenece a otro equipo. Elimínalo de su equipo actual antes de asignarlo aquí.",
      });
      return;
    }

    // 🚑 Ambulancia: opcional, puede ser null
    const normalizedAmbulance =
      ambulanceId === undefined
        ? undefined // no tocar
        : ambulanceId === null || ambulanceId === ""
          ? null
          : new mongoose.Types.ObjectId(ambulanceId);

    const updateDoc: any = {
      driver,
      medic,
      rotationMode: normalizedRotation,
      fixedDienstNumber: normalizedFixedDienst,
    };

    if (normalizedAmbulance !== undefined) {
      updateDoc.ambulanceId = normalizedAmbulance;
    }

    const updated = await Team.findByIdAndUpdate(id, updateDoc, {
      new: true,
      runValidators: true,
    })
      .populate("driver", "name lastName ambulanceRole pscheinExpiry")
      .populate("medic", "name lastName ambulanceRole pscheinExpiry")
      .populate("ambulanceId", "ambulanceNumber licensePlate");

    if (!updated) {
      res.status(404).json({ message: "Team no encontrado" });
      return;
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("❌ Error updateTeam:", err);
    res.status(500).json({ message: "Error al actualizar team" });
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const deleted = await Team.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: "Team no encontrado" });
      return;
    }
    res.status(200).json({ message: "Team eliminado" });
  } catch (err) {
    console.error("❌ Error deleteTeam:", err);
    res.status(500).json({ message: "Error al eliminar team" });
  }
};
