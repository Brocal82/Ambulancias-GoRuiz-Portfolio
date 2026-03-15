//src/controllers/vacationController.ts
import { Request, Response } from "express";
import type { IVacationRequestModel } from "../models/vacationRequest";
import VacationRequest from "../models/vacationRequest";
import { findOverCapacityDays } from "../utils/vacationCapacity";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import { clearUserFromDienstsInRange } from "../utils/dienstClearUtils";
import {
  DEFAULT_MAX_PER_DAY,
  findMonthConfig,
  getMaxPerDayForDate,
  toMonthKey,
} from "../modules/vacation";
import {
  getMonthConfig as getMonthConfigHandler,
  upsertMonthConfig as upsertMonthConfigHandler,
} from "../modules/vacation";

const ZONE = "Europe/Berlin";

// ✅ Añade aquí el tipo y el type guard (justo debajo de los imports de mongoose)
type VacationStatus = "pending" | "accepted" | "cancelled" | "option_sent";
function isVacationStatus(x: unknown): x is VacationStatus {
  return (
    x === "pending" ||
    x === "accepted" ||
    x === "cancelled" ||
    x === "option_sent"
  );
}
function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function isInRange(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  return t >= dayStart(start).getTime() && t <= dayEnd(end).getTime();
}

// ======================================================
// Controladores existentes
// ======================================================

// Obtener todas las solicitudes (solo admin)
export const getVacationRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requests = await VacationRequest.find().populate(
      "user",
      "name lastName email",
    );
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error al obtener solicitudes de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Crear nueva solicitud (trabajador)
export const createVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).userId; // del token
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      res
        .status(400)
        .json({ message: "Las fechas de inicio y fin son obligatorias" });
      return;
    }

    const newRequest = new VacationRequest({
      user: new mongoose.Types.ObjectId(userId),
      startDate,
      endDate,
      status: "pending",
      requestedAt: new Date(),
    });

    await newRequest.save();

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("Error al crear solicitud de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Worker cancela su propia solicitud (solo pending / option_sent)
export const cancelMyVacationRequest = async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const request = await VacationRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    // ✅ Seguridad: solo el dueño puede cancelar
    if (String(request.user) !== String(userId)) {
      return res.status(403).json({ message: "No puedes cancelar esta solicitud" });
    }

    // ✅ Solo permitir cancelar si está pendiente (y opcionalmente option_sent)
    const status = String(request.status);
    if (status !== "pending" && status !== "option_sent") {
      return res.status(400).json({ message: "Solo puedes cancelar solicitudes pendientes" });
    }

    request.status = "cancelled";
    await request.save();

    return res.status(200).json(request);
  } catch (err) {
    console.error("❌ cancelMyVacationRequest error:", err);
    return res.status(500).json({ message: "Error al cancelar la solicitud" });
  }
};


// Actualizar solicitud (admin): estado, alternativa, nota
export const updateVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
const { id } = req.params;

// Permitir "force" por query o body, pero SOLO admin podrá usarlo realmente
const forceRaw = (req.query.force ?? req.body?.force ?? req.body?.canForceAccept) as unknown;

const force =
  forceRaw === true ||
  forceRaw === "true" ||
  forceRaw === 1 ||
  forceRaw === "1";

const roleFromMiddleware = (req as any).userRole as string | undefined;
const roleFromReqUser = req.user?.role;
const isAdmin = roleFromMiddleware === "admin" || roleFromReqUser === "admin";
const canForceAccept = force && isAdmin;

const { status, adminOptionStartDate, adminOptionEndDate, adminNote } = req.body;

// 🔎 DEBUG temporal (borra luego)
console.log("FORCE DEBUG:", {
  id,
  status,
  forceRaw,
  force,
  isAdmin,
  role: req.user?.role,
  canForceAccept,
});



  let acceptedRange: {
    userId: string;
    startISO: string;
    endISO: string;
  } | null = null;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1) Cargar la solicitud dentro de la transacción
      const request = await VacationRequest.findById(id).session(session);
      if (!request) {
        res.status(404).json({ message: "Solicitud no encontrada" });
        throw new Error("__ABORT__");
      }

      // 2) Validación de capacidad SOLO si se va a aceptar
      //    (si es force + admin, se salta esta validación)
      if (status === "accepted" && !canForceAccept) {
        const maxPerDay = await getMaxPerDayForDate(new Date(request.startDate));

        const overDays = await findOverCapacityDays(
          VacationRequest,
          request.startDate,
          request.endDate,
          maxPerDay,
          request._id.toString(),
        );

        if (overDays.length > 0) {
          res.status(409).json({
            code: "capacity_exceeded",
            message: "Capacidad diaria alcanzada para uno o más días del rango.",
            days: overDays,
          });
          throw new Error("__ABORT__");
        }
      }

      // 🟠 Log si se fuerza aceptación por encima de capacidad
      if (status === "accepted" && canForceAccept) {
        console.warn(
          `⚠️ Admin forzó aceptación por encima de capacidad. requestId=${id}`,
        );
      }

      // 3) Actualizar campos permitidos
      if (typeof status !== "undefined") {
        if (isVacationStatus(status)) {
          request.status = status;
        } else {
          res.status(400).json({ message: "Estado inválido" });
          throw new Error("__ABORT__");
        }
      }

      if (adminOptionStartDate) {
        request.adminOptionStartDate = new Date(adminOptionStartDate);
      }
      if (adminOptionEndDate) {
        request.adminOptionEndDate = new Date(adminOptionEndDate);
      }
      if (typeof adminNote === "string") {
        request.adminNote = adminNote;
      }

      // 4) Guardar dentro de la transacción
      await request.save({ session });

      // 5) Si el estado final es 'accepted', preparamos el rango para limpiar Diensts
      if (request.status === "accepted") {
        const userIdStr = String(request.user);
        const startISO = DateTime.fromJSDate(request.startDate, {
          zone: ZONE,
        }).toISODate()!;
        const endISO = DateTime.fromJSDate(request.endDate, {
          zone: ZONE,
        }).toISODate()!;
        acceptedRange = { userId: userIdStr, startISO, endISO };
      }

      // 6) Responder OK con el doc actualizado
      res.status(200).json(request);
    });

    // 7) Fuera de la transacción: aplicar limpieza de Diensts si procede
    if (acceptedRange) {
      try {
        await clearUserFromDienstsInRange(acceptedRange);
      } catch (clearErr) {
        console.error(
          "⚠️ Error al desasignar usuario de Diensts tras aceptar vacaciones:",
          clearErr,
        );
      }
    }
  } catch (err: any) {
    if (err?.message === "__ABORT__") {
      return;
    }

    console.error("❌ Error al actualizar solicitud de vacaciones:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  } finally {
    session.endSession();
  }
};


// Responder a fecha alternativa (trabajador)
export const respondToAlternativeDate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { accept } = req.body; // boolean

    const request = (await VacationRequest.findById(
      id,
    )) as IVacationRequestModel | null;
    if (!request) {
      res.status(404).json({ message: "Solicitud no encontrada" });
      return;
    }

    if (request.user.toString() !== userId) {
      res
        .status(403)
        .json({ message: "No autorizado para responder a esta solicitud" });
      return;
    }

    let acceptedRange: {
      userId: string;
      startISO: string;
      endISO: string;
    } | null = null;

    if (accept) {
      // Usuario acepta la alternativa → actualizar fechas y estado
      if (request.adminOptionStartDate)
        request.startDate = request.adminOptionStartDate;
      if (request.adminOptionEndDate)
        request.endDate = request.adminOptionEndDate;
      request.status = "accepted";
      request.adminOptionStartDate = undefined;
      request.adminOptionEndDate = undefined;
      request.adminNote = undefined;

      // Preparar rango para limpiar Diensts
      const startISO = DateTime.fromJSDate(request.startDate, {
        zone: ZONE,
      }).toISODate()!;
      const endISO = DateTime.fromJSDate(request.endDate, {
        zone: ZONE,
      }).toISODate()!;
      acceptedRange = {
        userId: String(request.user),
        startISO,
        endISO,
      };
    } else {
      // Usuario rechaza → cancelar
      request.status = "cancelled";
      request.adminOptionStartDate = undefined;
      request.adminOptionEndDate = undefined;
      request.adminNote = undefined;
    }

    await request.save();

    // Si se aceptó la alternativa → limpiar Diensts afectados
    if (acceptedRange) {
      try {
        const clearResult = await clearUserFromDienstsInRange(acceptedRange);
        console.log(
          "🧹 Vacaciones (alternativa) limpiadas en Diensts:",
          clearResult,
        );
      } catch (err) {
        console.error(
          "❌ Error limpiando Diensts tras aceptar alternativa:",
          err,
        );
      }
    }

    res.status(200).json(request);
  } catch (error) {
    console.error("Error al responder a fecha alternativa:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getUserVacationRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).userId; // obtener id desde el token (middleware authenticateToken)
    const requests = await VacationRequest.find({ user: userId }).populate(
      "user",
      "name lastName email",
    );
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error al obtener solicitudes del usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const request = await VacationRequest.findById(id);

    if (!request) {
      res.status(404).json({ message: "Solicitud no encontrada" });
      return;
    }

    await request.deleteOne();

    res.status(200).json({ message: "Solicitud eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar solicitud de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/**
 * GET /vacations/count?status=pending
 * Devuelve { count: number }
 * - status por query (opcional), por defecto 'pending'
 * - se usa conteo derivado del propio módulo (sin duplicar notificaciones)
 */
export const getVacationPendingCount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rawStatus =
      typeof req.query.status === "string" ? req.query.status : "pending";
    const status = rawStatus.toLowerCase();

    const count = await VacationRequest.countDocuments({ status });
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error al contar solicitudes de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ======================================================
// NUEVO: Chequear vacaciones en un rango por usuario
// POST /vacations/check-range
// Payload: { userIds: string[], fromISO: 'YYYY-MM-DD', toISO: 'YYYY-MM-DD' }
// Respuesta: Record<userId, {
//   hasVacationInRange: boolean;
//   vacationStartInRange?: string; // 'YYYY-MM-DD' (acotado al rango solicitado)
//   vacationUntilInRange?: string; // 'YYYY-MM-DD' (acotado al rango solicitado)
// }}
// ======================================================
export const checkVacationsInRange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Helper local para 'YYYY-MM-DD' en Europe/Berlin
    const fmtYmdBerlin = (d: DateTime): string =>
      d.setZone(ZONE).toFormat("yyyy-LL-dd");

    const { userIds, fromISO, toISO } = req.body as {
      userIds?: string[];
      fromISO?: string;
      toISO?: string;
    };

    if (!Array.isArray(userIds) || userIds.length === 0 || !fromISO || !toISO) {
      res
        .status(400)
        .json({
          message:
            "Parámetros inválidos. Se requieren userIds[], fromISO y toISO.",
        });
      return;
    }

    // Normalizamos el rango en zona Berlín [00:00..23:59]
    const fromDT = DateTime.fromISO(fromISO, { zone: ZONE }).startOf("day");
    const toDT = DateTime.fromISO(toISO, { zone: ZONE }).endOf("day");

    if (!fromDT.isValid || !toDT.isValid || fromDT > toDT) {
      res.status(400).json({ message: "Rango de fechas inválido." });
      return;
    }

    const userObjectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

    // Solo solicitudes ACCEPTED que SOLAPEN el rango
    const requests = await VacationRequest.find({
      status: "accepted",
      user: { $in: userObjectIds },
      startDate: { $lte: toDT.toJSDate() },
      endDate: { $gte: fromDT.toJSDate() },
    })
      .select("user startDate endDate")
      .lean();

    type Flags = {
      hasVacationInRange: boolean;
      vacationStartInRange?: string; // recortado a la semana
      vacationUntilInRange?: string;
      vacationStartFull?: string; // rango real completo
      vacationUntilFull?: string;
    };

    const result: Record<string, Flags> = {};
    for (const id of userIds) {
      result[id] = { hasVacationInRange: false };
    }

    // Reducimos por usuario: mantenemos tanto el rango en la semana (overlap)
    // como el rango FULL real que pisa esa semana (para tooltip correcto)
    for (const r of requests) {
      const uid = String(r.user);

      const reqStart = DateTime.fromJSDate(r.startDate as Date, {
        zone: ZONE,
      }).startOf("day");
      const reqEnd = DateTime.fromJSDate(r.endDate as Date, {
        zone: ZONE,
      }).endOf("day");

      // Rango solapado con la semana (para palmera/apagado)
      const overlapStart = reqStart < fromDT ? fromDT : reqStart;
      const overlapEnd = reqEnd > toDT ? toDT : reqEnd;
      if (overlapStart > overlapEnd) continue;

      const prev = result[uid];

      if (!prev || !prev.hasVacationInRange) {
        result[uid] = {
          hasVacationInRange: true,
          vacationStartInRange: fmtYmdBerlin(overlapStart),
          vacationUntilInRange: fmtYmdBerlin(overlapEnd),
          vacationStartFull: fmtYmdBerlin(reqStart),
          vacationUntilFull: fmtYmdBerlin(reqEnd),
        };
      } else {
        // Unimos: min/max para IN-RANGE y para FULL
        const prevInStart = DateTime.fromISO(prev.vacationStartInRange!, {
          zone: ZONE,
        }).startOf("day");
        const prevInEnd = DateTime.fromISO(prev.vacationUntilInRange!, {
          zone: ZONE,
        }).endOf("day");

        const newInStart =
          prevInStart < overlapStart ? prevInStart : overlapStart;
        const newInEnd = prevInEnd > overlapEnd ? prevInEnd : overlapEnd;

        const prevFullStart = prev.vacationStartFull
          ? DateTime.fromISO(prev.vacationStartFull, { zone: ZONE }).startOf(
              "day",
            )
          : reqStart;
        const prevFullEnd = prev.vacationUntilFull
          ? DateTime.fromISO(prev.vacationUntilFull, { zone: ZONE }).endOf(
              "day",
            )
          : reqEnd;

        const newFullStart =
          prevFullStart < reqStart ? prevFullStart : reqStart;
        const newFullEnd = prevFullEnd > reqEnd ? prevFullEnd : reqEnd;

        result[uid] = {
          hasVacationInRange: true,
          vacationStartInRange: fmtYmdBerlin(newInStart),
          vacationUntilInRange: fmtYmdBerlin(newInEnd),
          vacationStartFull: fmtYmdBerlin(newFullStart),
          vacationUntilFull: fmtYmdBerlin(newFullEnd),
        };
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error en checkVacationsInRange:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ======================================================
// NUEVO: Disponibilidad mensual (enmascara blackouts como capacidad)
// ======================================================

// GET /vacations/availability?year=YYYY&month=MM
// Respuesta: { year, month, maxPerDay, days:[{ day, approvedCount, pendingCount, remaining, state }] }
// state: "green" | "yellow" | "red"
export const getAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month); // 1..12

    if (!year || !month || month < 1 || month > 12) {
      res
        .status(400)
        .json({
          message: "Parámetros inválidos: year y month (1..12) son requeridos",
        });
      return;
    }

    const monthKey = toMonthKey(year, month);
    const monthStart = dayStart(new Date(year, month - 1, 1));
    const monthEnd = dayEnd(new Date(year, month, 0));
    const cfg = await findMonthConfig(monthKey);

    const maxPerDay = cfg?.maxPerDay ?? DEFAULT_MAX_PER_DAY;
    const blackouts = cfg?.blackouts ?? [];

    // Trae solicitudes que solapan el mes y que afectan a la disponibilidad visual
    const requests = await VacationRequest.find({
      status: { $in: ["pending", "accepted"] }, // 'option_sent' la puedes añadir si la consideras "pendiente"
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .select("startDate endDate status user")
      .lean();

    const daysInMonth = new Date(year, month, 0).getDate();
    const days: {
      day: number;
      approvedCount: number;
      pendingCount: number;
      remaining: number; // restante en base a ACEPTADAS (nuevo significado)
      state: "green" | "yellow" | "red";
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, month - 1, d);

      // Blackout → enmascarar como capacidad llena
      const isBlackout = blackouts.some((r) =>
        isInRange(current, r.startDate, r.endDate),
      );
      if (isBlackout) {
        days.push({
          day: d,
          approvedCount: maxPerDay,
          pendingCount: 0,
          remaining: 0,
          state: "red",
        });
        continue;
      }

      // Conteos por día
      let approvedCount = 0;
      let pendingCount = 0;

      for (const r of requests) {
        if (isInRange(current, r.startDate as Date, r.endDate as Date)) {
          if (r.status === "accepted") approvedCount += 1;
          else if (r.status === "pending") pendingCount += 1;
        }
      }

      // 🔴 NUEVO: remaining basado SOLO en aceptadas
      const remaining = Math.max(0, maxPerDay - approvedCount);

      // 🔴 NUEVAS reglas de color
      const state: "green" | "yellow" | "red" =
        approvedCount >= maxPerDay
          ? "red"
          : pendingCount > 0
            ? "yellow"
            : "green";

      days.push({ day: d, approvedCount, pendingCount, remaining, state });
    }

    res.status(200).json({ year, month, maxPerDay, days });
  } catch (error) {
    console.error("Error al calcular disponibilidad:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ======================================================
// NUEVO: Config mensual (admin)
// ======================================================

// GET /vacations/month-config?monthKey=YYYY-MM
export const getMonthConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  return getMonthConfigHandler(req, res);
};

// POST /vacations/month-config  { monthKey, maxPerDay, blackouts:[{startDate,endDate}] }
export const upsertMonthConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  return upsertMonthConfigHandler(req, res);
};
