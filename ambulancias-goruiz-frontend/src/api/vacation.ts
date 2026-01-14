// frontend/src/api/vacation.ts
import axiosInstance from "./axios";
import type { IVacationRequest } from "../types/vacationRequest";
import {
  emitAvailabilityInvalidated,
  emitVacationRequestsUpdated,
} from "../utils/vacation/vacationEvents";



/* =========================
   Tipos y payloads básicos
   ========================= */

interface VacationRequestPayload {
  startDate: string;
  endDate: string;
}

interface UpdateVacationPayload {
  status?: "pending" | "accepted" | "cancelled" | "option_sent";
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
export const createVacationRequest = async (
  token: string,
  data: VacationRequestPayload,
) => {
  const response = await axiosInstance.post("/vacations", data, {
    headers: { Authorization: `Bearer ${token}` },
  });

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
export const getVacationRequests = async (token: string) => {
  const response = await axiosInstance.get("/vacations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Actualizar una solicitud (solo admin)
export const updateVacationRequest = async (
  token: string,
  id: string,
  data: UpdateVacationPayload,
) => {
  try {
    const response = await axiosInstance.patch(`/vacations/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
export const getUserVacationRequests = async (token: string) => {
  const response = await axiosInstance.get("/vacations/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Responder a opción alternativa (aceptar o rechazar)
export const respondToAlternativeDate = async (
  token: string,
  id: string,
  data: RespondAlternativePayload,
) => {
  const response = await axiosInstance.post(`/vacations/${id}/respond`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Eliminar solicitud (solo admin)
export const deleteVacationRequest = async (token: string, id: string) => {
  const response = await axiosInstance.delete(`/vacations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Cancelar solicitud propia (worker, solo si está pending / option_sent)
export const cancelMyVacationRequest = async (token: string, id: string) => {
  const response = await axiosInstance.patch(
    `/vacations/${id}/cancel`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  return response.data;
};



/* =========================
   Contador pendientes
   ========================= */

export const getVacationPendingCount = async (
  token: string,
  status: VacationStatusCount = "pending",
): Promise<number> => {
  try {
    const response = await axiosInstance.get<VacationCountResponse>(
      "/vacations/count",
      {
        params: { status },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return typeof response.data?.count === "number" ? response.data.count : 0;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Error al obtener el contador de solicitudes de vacaciones";
    throw new Error(message);
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

export async function upsertVacationMonthConfig(payload: VacationMonthConfig) {
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
 * @param token   JWT del usuario autenticado
 * @param userIds IDs de usuarios a consultar
 * @param fromISO ISO 'YYYY-MM-DD' inclusive (inicio de semana)
 * @param toISO   ISO 'YYYY-MM-DD' inclusive (fin de semana -> start + 6)
 * @param includeFullSpan si true, el backend devolverá (si lo soporta) vacationStartFull/vacationUntilFull
 *
 * Respuesta: Record<userId, VacFlag>
 */
export async function getVacationFlagsInRange(
  token: string,
  params: {
    userIds: string[];
    fromISO: string;
    toISO: string;
    includeFullSpan?: boolean;
  },
): Promise<VacationFlagsByUser> {
  const { data } = await axiosInstance.post<VacationFlagsByUser>(
    "/vacations/check-range",
    {
      userIds: params.userIds,
      fromISO: params.fromISO,
      toISO: params.toISO,
      includeFullSpan: params.includeFullSpan, // ⬅️ si el backend lo usa, perfecto; si no, lo ignora
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
}

/* =========================================================
   Caché + invalidación por mes y evento
   ========================================================= */

type MonthKey = string;
const toMonthKey = (y: number, m1: number) =>
  `${y}-${String(m1).padStart(2, "0")}`;

const availabilityCache = new Map<MonthKey, VacationAvailabilityResponse>();

export function getCachedAvailability(year: number, month: number) {
  return availabilityCache.get(toMonthKey(year, month));
}

export function setCachedAvailability(
  year: number,
  month: number,
  data: VacationAvailabilityResponse,
) {
  availabilityCache.set(toMonthKey(year, month), data);
}

/**
 * Invalida la disponibilidad en memoria para (año, mes) y difunde a:
 * - misma pestaña: CustomEvent('vacation-availability-invalidated')
 * - otras pestañas: BroadcastChannel 'vacations' y evento 'storage'
 *
 * month: 1..12
 */
export function invalidateAvailability(year: number, month: number) {
  try {
    availabilityCache.delete(toMonthKey(year, month));
  } catch {}

  // misma pestaña
  try {
    window.dispatchEvent(
      new CustomEvent("vacation-availability-invalidated", {
        detail: { year, month },
      }),
    );
  } catch {}

  // otras pestañas: BroadcastChannel
  let bc: BroadcastChannel | null = null;
  try {
    const BC = (window as any).BroadcastChannel as
      | (new (name: string) => BroadcastChannel)
      | undefined;
    if (typeof BC === "function") {
      bc = new BC("vacations");
      bc.postMessage({
        type: "availability-invalidated",
        year,
        month,
        ts: Date.now(),
      });
      bc.close?.();
    }
  } catch {}

  // otras pestañas: fallback localStorage
  try {
    localStorage.setItem(
      "__vac_av_inval__",
      JSON.stringify({ year, month, ts: Date.now() }),
    );
  } catch {}
}

export function invalidateThisAndNextMonth(year: number, month1: number) {
  // month1: 1..12
  emitAvailabilityInvalidated({ year, month: month1 });

  // siguiente mes (con salto de año)
  if (month1 === 12) emitAvailabilityInvalidated({ year: year + 1, month: 1 });
  else emitAvailabilityInvalidated({ year, month: month1 + 1 });
}


/* =========================================================
   Helpers de invalidación por evento y por rango (TZ Berlín)
   ========================================================= */

export function emitAvailabilityInvalidation(year: number, month: number) {
  invalidateAvailability(year, month);
}

function getBerlinYearMonth(iso: string): { y: number; m1: number } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const y = Number(
    d.toLocaleString("en-CA", { year: "numeric", timeZone: "Europe/Berlin" }),
  );
  const m1 = Number(
    d.toLocaleString("en-CA", { month: "2-digit", timeZone: "Europe/Berlin" }),
  );
  if (!y || !m1) return null;
  return { y, m1 };
}

export function invalidateAvailabilityByRange(startISO: string, endISO: string) {
  const startYM = getBerlinYearMonth(startISO);
  const endYM = getBerlinYearMonth(endISO);
  if (!startYM || !endYM) return;

  // Iteramos meses entre startYM y endYM, ambos inclusive (en "Berlin")
  let y = startYM.y;
  let m1 = startYM.m1; // 1..12

  const endY = endYM.y;
  const endM1 = endYM.m1;

  while (y < endY || (y === endY && m1 <= endM1)) {
    emitAvailabilityInvalidated({ year: y, month: m1 }); // month 1..12

    m1++;
    if (m1 > 12) {
      m1 = 1;
      y++;
    }
  }
}


