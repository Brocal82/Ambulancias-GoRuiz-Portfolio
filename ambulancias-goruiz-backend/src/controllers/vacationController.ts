//src/controllers/vacationController.ts
import { Request, Response } from "express";
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
  updateVacationRequest as updateVacationRequestHandler,
  upsertMonthConfig as upsertMonthConfigHandler,
} from "../modules/vacation";

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
  return updateVacationRequestHandler(req, res);
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
