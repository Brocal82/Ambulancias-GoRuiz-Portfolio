// frontend/src/api/vacation.ts
import axiosInstance from "./axios";
import type { IVacationRequest } from "../types/vacationRequest";

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

  // 🔔 NUEVO: difundir que el listado de solicitudes cambió (para que Admin recargue sin refresh)
  try {
    // misma pestaña
    window.dispatchEvent(
      new CustomEvent("vacation-requests-updated", {
        detail: { ts: Date.now() },
      }),
    );
  } catch {}
  try {
    // otras pestañas: BroadcastChannel
    const BC = (window as any).BroadcastChannel as
      | (new (name: string) => BroadcastChannel)
      | undefined;
    if (typeof BC === "function") {
      const bc = new BC("vacations");
      bc.postMessage({ type: "requests-updated", ts: Date.now() });
      bc.close?.();
    }
  } catch {}
  try {
    // fallback: localStorage
    localStorage.setItem("__vac_req_upd__", JSON.stringify({ ts: Date.now() }));
  } catch {}

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

/**
 * Helper para invalidar el mes actual y el siguiente (útil tras aceptar/cancelar).
 */
export function invalidateThisAndNextMonth(year: number, month: number) {
  invalidateAvailability(year, month);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  invalidateAvailability(next.y, next.m);
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

// ✅ Versión limpia y compatible (sin warnings)
export function invalidateAvailabilityByRange(
  startDate: string,
  _endDate?: string,
) {
  try {
    // 🗓️ Si existe helper getBerlinYearMonth, úsalo:
    let year: number, month: number;

    if (typeof getBerlinYearMonth === "function") {
      const startInfo = getBerlinYearMonth(startDate);
      if (!startInfo) return;
      year = startInfo.y;
      month = startInfo.m1;
    } else {
      const start = new Date(startDate);
      year = start.getFullYear();
      month = start.getMonth() + 1;
    }

    // 1️⃣ CustomEvent (misma pestaña)
    window.dispatchEvent(
      new CustomEvent("vacation-availability-invalidated", {
        detail: { year, month },
      }),
    );

    // 2️⃣ BroadcastChannel (otras pestañas/ventanas)
    try {
      const bc = new BroadcastChannel("vacations");
      bc.postMessage({ type: "availability-invalidated", year, month });
      bc.close?.();
    } catch {}

    // 3️⃣ localStorage (fallback universal)
    try {
      localStorage.setItem(
        "__vac_av_inval__",
        JSON.stringify({ year, month, ts: Date.now() }),
      );
    } catch {}

    // 🧹 limpiar almacenamiento para evitar eventos acumulados
    setTimeout(() => {
      try {
        localStorage.removeItem("__vac_av_inval__");
      } catch {}
    }, 2000);
  } catch (err) {
    console.warn("Error invalidando disponibilidad:", err);
  }
}
