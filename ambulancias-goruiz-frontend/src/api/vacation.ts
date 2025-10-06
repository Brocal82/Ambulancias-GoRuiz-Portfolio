// frontend/src/api/vacation.ts
import axiosInstance from './axios';
import type { IVacationRequest } from '../types/vacationRequest';
import api from './axios';

interface VacationRequestPayload {
  startDate: string;
  endDate: string;
}

// Crear nueva solicitud
export const createVacationRequest = async (token: string, data: VacationRequestPayload) => {
  const response = await axiosInstance.post('/vacations', data, {
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
    window.dispatchEvent(new CustomEvent('vacation-requests-updated', { detail: { ts: Date.now() } }));
  } catch {}
  try {
    // otras pestañas: BroadcastChannel
    const BC = (window as any).BroadcastChannel as
      | (new (name: string) => BroadcastChannel)
      | undefined;
    if (typeof BC === 'function') {
      const bc = new BC('vacations');
      bc.postMessage({ type: 'requests-updated', ts: Date.now() });
      bc.close?.();
    }
  } catch {}
  try {
    // fallback: localStorage
    localStorage.setItem('__vac_req_upd__', JSON.stringify({ ts: Date.now() }));
  } catch {}

  return response.data;
};

// Obtener todas las solicitudes (solo admin)
export const getVacationRequests = async (token: string) => {
  const response = await axiosInstance.get('/vacations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

interface UpdateVacationPayload {
  status?: 'pending' | 'accepted' | 'cancelled' | 'option_sent';
  adminOptionStartDate?: string;
  adminOptionEndDate?: string;
  adminNote?: string;
}

// Actualizar una solicitud (solo admin)
export const updateVacationRequest = async (token: string, id: string, data: UpdateVacationPayload) => {
  const response = await axiosInstance.patch(`/vacations/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Obtener solicitudes del trabajador logueado
export const getUserVacationRequests = async (token: string) => {
  const response = await axiosInstance.get('/vacations/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

interface RespondAlternativePayload {
  accept: boolean;
}

// Responder a opción alternativa (aceptar o rechazar)
export const respondToAlternativeDate = async (token: string, id: string, data: RespondAlternativePayload) => {
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
   NUEVO: contador pendientes
   ========================= */

type VacationStatusCount = IVacationRequest['status'];

interface VacationCountResponse {
  count: number;
}

export const getVacationPendingCount = async (
  token: string,
  status: VacationStatusCount = 'pending'
): Promise<number> => {
  try {
    const response = await axiosInstance.get<VacationCountResponse>('/vacations/count', {
      params: { status },
      headers: { Authorization: `Bearer ${token}` },
    });
    return typeof response.data?.count === 'number' ? response.data.count : 0;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Error al obtener el contador de solicitudes de vacaciones';
    throw new Error(message);
  }
};

// Respuesta del endpoint de disponibilidad mensual
export interface VacationAvailabilityDay {
  day: number;
  approvedCount: number;
  pendingCount: number;
  remaining: number;
  state: 'green' | 'yellow' | 'red';
}
export interface VacationAvailabilityResponse {
  year: number;
  month: number; // 1..12
  maxPerDay: number;
  days: VacationAvailabilityDay[];
}

// Config mensual (admin): capacidad y bloqueos (blackouts)
export interface VacationMonthConfig {
  monthKey: string; // "YYYY-MM"
  maxPerDay: number;
  blackouts: { startDate: string; endDate: string }[];
}

/**
 * Obtiene disponibilidad mensual (colores + contadores por día)
 * GET /vacations/availability?year=YYYY&month=MM
 *
 * opts.force = true → ignora caché
 */
export async function getVacationAvailability(
  params: { year: number; month: number }, // month 1..12
  opts?: { force?: boolean }
) {
  const { year, month } = params;

  if (!opts?.force) {
    const cached = getCachedAvailability(year, month);
    if (cached) return cached;
  }

  const { data } = await api.get<VacationAvailabilityResponse>('/vacations/availability', {
    params,
  });

  setCachedAvailability(year, month, data);
  return data;
}

/**
 * (ADMIN) Obtiene la configuración mensual (capacidad + blackouts)
 * GET /vacations/month-config?monthKey=YYYY-MM
 */
export async function getVacationMonthConfig(monthKey: string) {
  const { data } = await api.get<VacationMonthConfig>('/vacations/month-config', {
    params: { monthKey },
  });
  return data;
}

/**
 * (ADMIN) Crea/actualiza la configuración mensual
 * POST /vacations/month-config
 */
export async function upsertVacationMonthConfig(payload: VacationMonthConfig) {
  const { data } = await api.post<VacationMonthConfig>('/vacations/month-config', payload);
  return data;
}

/* =========================================================
   Caché + invalidación por mes y evento
   ========================================================= */

type MonthKey = string;
const toMonthKey = (y: number, m1: number) => `${y}-${String(m1).padStart(2, '0')}`;

const availabilityCache = new Map<MonthKey, VacationAvailabilityResponse>();

export function getCachedAvailability(year: number, month: number) {
  return availabilityCache.get(toMonthKey(year, month));
}

export function setCachedAvailability(year: number, month: number, data: VacationAvailabilityResponse) {
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
      new CustomEvent('vacation-availability-invalidated', {
        detail: { year, month },
      })
    );
  } catch {}

  // otras pestañas: BroadcastChannel
  let bc: BroadcastChannel | null = null;
  try {
    const BC = (window as any).BroadcastChannel as
      | (new (name: string) => BroadcastChannel)
      | undefined;
    if (typeof BC === 'function') {
      bc = new BC('vacations');
      bc.postMessage({ type: 'availability-invalidated', year, month, ts: Date.now() });
      bc.close?.();
    }
  } catch {}

  // otras pestañas: fallback localStorage
  try {
    localStorage.setItem(
      '__vac_av_inval__',
      JSON.stringify({ year, month, ts: Date.now() })
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
    d.toLocaleString('en-CA', { year: 'numeric', timeZone: 'Europe/Berlin' })
  );
  const m1 = Number(
    d.toLocaleString('en-CA', { month: '2-digit', timeZone: 'Europe/Berlin' })
  );
  if (!y || !m1) return null;
  return { y, m1 };
}

/** Emite invalidaciones para todos los meses entre startISO y endISO (inclusive) */
export function invalidateAvailabilityByRange(startISO: string, endISO: string) {
  const startYM = getBerlinYearMonth(startISO);
  const endYM = getBerlinYearMonth(endISO);
  if (!startYM || !endYM) return;

  let { y, m1 } = startYM;
  const endY = endYM.y;
  const endM1 = endYM.m1;

  while (y < endY || (y === endY && m1 <= endM1)) {
    emitAvailabilityInvalidation(y, m1);
    if (m1 === 12) {
      y += 1;
      m1 = 1;
    } else {
      m1 += 1;
    }
  }
}
