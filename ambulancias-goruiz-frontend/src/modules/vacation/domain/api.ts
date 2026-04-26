// frontend/src/api/vacation.ts
import axiosInstance from "../../../api/axios";
import { getApiErrorMessage } from "../../../utils/toast";
import type { IVacationRequest } from "./types";
import {
  emitAvailabilityInvalidated,
  emitVacationRequestsUpdated,
} from "../utils/vacationEvents";
import {
  getCachedAvailability,
  setCachedAvailability,
  deleteCachedAvailability
} from "../utils/vacationAvailabilityCache";
import { invalidateAvailabilityByRangeBerlin } from "../utils/invalidateAvailabilityByRangeBerlin";




/* =========================
   Tipos y payloads básicos
   ========================= */

interface VacationRequestPayload {
  startDate: string;
  endDate: string;
}

interface UpdateVacationPayload {
  status?:
    | "pending"
    | "accepted"
    | "cancelled"
    | "option_sent"
    | "cancel_requested";
  startDate?: string;
  endDate?: string;
  adminOptionStartDate?: string;
  adminOptionEndDate?: string;
  adminNote?: string;
  force?: boolean;
}

interface RespondAlternativePayload {
  accept: boolean;
}

type VacationStatusCount = IVacationRequest["status"];

interface VacationCountResponse {
  count: number;
}

/* =========================
   NUEVO: tipos flags en rango
   ========================= */
/**
 * VacFlag: unifica flags acotados al rango consultado y el rango REAL completo.
 * - hasVacationInRange: indica si existe solape en el rango consultado
 * - vacationStartInRange / vacationUntilInRange: tramo acotado dentro del rango consultado
 * - vacationStartFull / vacationUntilFull: tramo real completo (si el backend lo envía)
 */
export interface VacFlag {
  hasVacationInRange: boolean;
  vacationStartInRange?: string; // 'YYYY-MM-DD' dentro del rango consultado
  vacationUntilInRange?: string; // 'YYYY-MM-DD' dentro del rango consultado
  vacationStartFull?: string; // 'YYYY-MM-DD' rango REAL completo (opcional si backend lo soporta)
  vacationUntilFull?: string; // 'YYYY-MM-DD' rango REAL completo (opcional si backend lo soporta)
}

export type VacationFlagsByUser = Record<string, VacFlag>;

// Compatibilidad con tu código previo
export type VacationRangeFlag = VacFlag;
export type VacationRangeFlagsByUser = VacationFlagsByUser;

/* =========================
   Crear / listar / actualizar
   ========================= */

// Crear nueva solicitud
export const createVacationRequest = async (data: VacationRequestPayload) => {
  const response = await axiosInstance.post("/vacations", data);

  // 🔔 Invalidar disponibilidad de los meses afectados para que Worker vea amarillo al instante
  try {
    invalidateAvailabilityByRange(data.startDate, data.endDate);
  } catch {
    // noop
  }

  // 🔔 Difundir que el listado de solicitudes cambió (Admin/Worker/otras pestañas)
try {
  const createdId = (response.data as any)?._id;
  if (createdId) {
    emitVacationRequestsUpdated({ type: "created", id: String(createdId) });
  } else {
    // Si por algún motivo no llega _id, enviamos un "updated" genérico con un id dummy estable
    // (pero idealmente siempre habrá _id).
    emitVacationRequestsUpdated({ type: "updated", id: "unknown" });
  }
} catch {
  // noop
}


  return response.data;
};

// Obtener todas las solicitudes (solo admin)
export const getVacationRequests = async () => {
  const response = await axiosInstance.get("/vacations");
  return response.data;
};

// Actualizar una solicitud (solo admin)
export const updateVacationRequest = async (
  id: string,
  data: UpdateVacationPayload,
) => {
  try {
    const response = await axiosInstance.patch(`/vacations/${id}`, data);
    return response.data;
  } catch (e: any) {
    // Normalizar el error para que los callers puedan hacer e.status / e.body
    const status = e?.response?.status;
    const respData = e?.response?.data;
    const err: any = new Error(
      (typeof respData?.message === "string" && respData.message) ||
        `Request failed with ${status ?? "unknown status"}`,
    );
    err.status = status; // ⬅️ MUY IMPORTANTE (p.ej., 409)
    err.body = respData; // ⬅️ Aquí llega { code: 'capacity_exceeded', days: [...] }
    throw err;
  }
};

// Obtener solicitudes del trabajador logueado
export const getUserVacationRequests = async () => {
  const response = await axiosInstance.get("/vacations/user");
  return response.data;
};

// Responder a opción alternativa (aceptar o rechazar)
export const respondToAlternativeDate = async (
  id: string,
  data: RespondAlternativePayload,
) => {
  const response = await axiosInstance.post(`/vacations/${id}/respond`, data);
  return response.data;
};

// Eliminar solicitud (solo admin)
export const deleteVacationRequest = async (id: string) => {
  const response = await axiosInstance.delete(`/vacations/${id}`);
  return response.data;
};

// Cancelar solicitud propia (worker, solo si está pending / option_sent)
export const cancelMyVacationRequest = async (id: string) => {
  const response = await axiosInstance.patch(`/vacations/${id}/cancel`, {});
  return response.data;
};



/* =========================
   Contador pendientes
   ========================= */

export const getVacationPendingCount = async (
  status: VacationStatusCount = "pending",
): Promise<number> => {
  try {
    const response = await axiosInstance.get<VacationCountResponse>(
      "/vacations/count",
      { params: { status } },
    );
    return typeof response.data?.count === "number" ? response.data.count : 0;
  } catch (error: unknown) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Error al obtener el contador de solicitudes de vacaciones",
      ),
    );
  }
};

/* =========================
   Disponibilidad mensual
   ========================= */

export interface VacationAvailabilityDay {
  day: number;
  approvedCount: number;
  pendingCount: number;
  remaining: number;
  state: "green" | "yellow" | "red";
}
export interface VacationAvailabilityResponse {
  year: number;
  month: number; // 1..12
  maxPerDay: number;
  days: VacationAvailabilityDay[];
}

export interface VacationMonthConfig {
  monthKey: string; // "YYYY-MM"
  maxPerDay: number;
  blackouts: { startDate: string; endDate: string }[];
}

/** POST body: backend allows partial updates (omit blackouts to leave unchanged). */
export type UpsertVacationMonthConfigPayload = {
  monthKey: string;
  maxPerDay?: number;
  blackouts?: { startDate: string; endDate: string }[];
};

export async function getVacationAvailability(
  params: { year: number; month: number }, // month 1..12
  opts?: { force?: boolean },
) {
  const { year, month } = params;

  if (!opts?.force) {
    const cached = getCachedAvailability(year, month);
    if (cached) return cached;
  }

  const { data } = await axiosInstance.get<VacationAvailabilityResponse>(
    "/vacations/availability",
    {
      params,
    },
  );

  setCachedAvailability(year, month, data);
  return data;
}

export async function getVacationMonthConfig(monthKey: string) {
  const { data } = await axiosInstance.get<VacationMonthConfig>(
    "/vacations/month-config",
    {
      params: { monthKey },
    },
  );
  return data;
}

export async function upsertVacationMonthConfig(
  payload: UpsertVacationMonthConfigPayload,
) {
  const { data } = await axiosInstance.post<VacationMonthConfig>(
    "/vacations/month-config",
    payload,
  );
  return data;
}

/* =========================
   Flags en rango (semanal)
   ========================= */
/**
 * Devuelve flags de vacaciones por usuario para un rango.
 * POST /vacations/check-range
 *
 * @param params.userIds IDs de usuarios a consultar
 * @param fromISO ISO 'YYYY-MM-DD' inclusive (inicio de semana)
 * @param toISO   ISO 'YYYY-MM-DD' inclusive (fin de semana -> start + 6)
 * @param includeFullSpan si true, el backend devolverá (si lo soporta) vacationStartFull/vacationUntilFull
 *
 * Respuesta: Record<userId, VacFlag>
 */
export async function getVacationFlagsInRange(params: {
  userIds: string[];
  fromISO: string;
  toISO: string;
  includeFullSpan?: boolean;
}): Promise<VacationFlagsByUser> {
  const { data } = await axiosInstance.post<VacationFlagsByUser>(
    "/vacations/check-range",
    {
      userIds: params.userIds,
      fromISO: params.fromISO,
      toISO: params.toISO,
      includeFullSpan: params.includeFullSpan,
    },
  );
  return data;
}

/**
 * Invalida la disponibilidad en memoria para (año, mes) y difunde el evento
 * usando el bus oficial de vacaciones.
 *
 * month: 1..12
 *
 * ⚠️ Importante:
 * - Aquí NO reimplementamos CustomEvent/BroadcastChannel/localStorage.
 * - Eso vive en utils/vacation/vacationAvailabilityEvents.ts
 */
export function invalidateAvailability(year: number, month: number) {
  // 1) borrar caché en memoria (por pestaña)
  try {
    deleteCachedAvailability(year, month);
  } catch {
    /* noop */
  }

  // 2) difundir invalidación (misma pestaña + otras pestañas)
  try {
    emitAvailabilityInvalidated({ year, month });
  } catch {
    /* noop */
  }
}


export function invalidateThisAndNextMonth(year: number, month1: number) {
  // month1: 1..12
  invalidateAvailability(year, month1);

  // siguiente mes (con salto de año)
  if (month1 === 12) invalidateAvailability(year + 1, 1);
  else invalidateAvailability(year, month1 + 1);
}


export function invalidateAvailabilityByRange(startISO: string, endISO: string) {
  invalidateAvailabilityByRangeBerlin(startISO, endISO);
}




