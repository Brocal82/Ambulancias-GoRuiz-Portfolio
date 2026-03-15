//src/controllers/vacationController.ts
import { Request, Response } from "express";
import type { IVacationRequestModel } from "../models/vacationRequest";
import VacationRequest from "../models/vacationRequest";
import { findOverCapacityDays } from "../utils/vacationCapacity";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import { clearUserFromDienstsInRange } from "../utils/dienstClearUtils";
import {
  applyAdminVacationUpdateFields,
  applyAlternativeDateResponse,
  buildAcceptedVacationRange,
  getMaxPerDayForDate,
  isVacationStatus,
  parseVacationUpdateAuthorization,
} from "../modules/vacation";
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
  respondToAlternativeDate as respondToAlternativeDateHandler,
  upsertMonthConfig as upsertMonthConfigHandler,
} from "../modules/vacation";

const ZONE = "Europe/Berlin";

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

const { status, adminOptionStartDate, adminOptionEndDate, adminNote } = req.body;
const { forceRaw, force, isAdmin, canForceAccept } =
  parseVacationUpdateAuthorization(req, req.body);

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
          applyAdminVacationUpdateFields(request, {
            status,
            adminOptionStartDate,
            adminOptionEndDate,
            adminNote,
          });
        } else {
          res.status(400).json({ message: "Estado inválido" });
          throw new Error("__ABORT__");
        }
      } else {
        applyAdminVacationUpdateFields(request, {
          adminOptionStartDate,
          adminOptionEndDate,
          adminNote,
        });
      }

      // 4) Guardar dentro de la transacción
      await request.save({ session });

      // 5) Si el estado final es 'accepted', preparamos el rango para limpiar Diensts
      if (request.status === "accepted") {
        acceptedRange = buildAcceptedVacationRange(request);
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
  return respondToAlternativeDateHandler(req, res);
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
