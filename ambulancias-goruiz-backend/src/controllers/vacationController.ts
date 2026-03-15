//src/controllers/vacationController.ts
import { Request, Response } from "express";
import type { IVacationRequestModel } from "../models/vacationRequest";
import VacationRequest from "../models/vacationRequest";
import { findOverCapacityDays } from "../utils/vacationCapacity";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import { clearUserFromDienstsInRange } from "../utils/dienstClearUtils";
import { getMaxPerDayForDate } from "../modules/vacation";
import {
  cancelMyVacationRequest as cancelMyVacationRequestHandler,
  createVacationRequest as createVacationRequestHandler,
  deleteVacationRequest as deleteVacationRequestHandler,
  getAvailability as getAvailabilityHandler,
  checkVacationsInRange as checkVacationsInRangeHandler,
  getMonthConfig as getMonthConfigHandler,
  getVacationPendingCount as getVacationPendingCountHandler,
  getVacationRequests as getVacationRequestsHandler,
  getUserVacationRequests as getUserVacationRequestsHandler,
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

// ======================================================
// Controladores existentes
// ======================================================

// Obtener todas las solicitudes (solo admin)
export const getVacationRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  return getVacationRequestsHandler(req, res);
};

// Crear nueva solicitud (trabajador)
export const createVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  return createVacationRequestHandler(req, res);
};

// Worker cancela su propia solicitud (solo pending / option_sent)
export const cancelMyVacationRequest = async (req: any, res: any) => {
  return cancelMyVacationRequestHandler(req, res);
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
  return getUserVacationRequestsHandler(req, res);
};

export const deleteVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  return deleteVacationRequestHandler(req, res);
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
  return getVacationPendingCountHandler(req, res);
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
  return checkVacationsInRangeHandler(req, res);
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
  return getAvailabilityHandler(req, res);
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
