// frontend/src/utils/vacation/vacationAvailabilityCache.ts
import type { VacationAvailabilityResponse } from "../../api/vacation";

/**
 * Caché en memoria para disponibilidad mensual de vacaciones.
 * - Key: "YYYY-MM" (month 1..12)
 * - Value: VacationAvailabilityResponse
 *
 * Nota:
 * - Este caché es intencionalmente en memoria (por pestaña).
 * - La invalidación cross-tab se gestiona vía eventos en otros módulos.
 */

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
 * Solo para infraestructura (Fase 2+):
 * Permite invalidar el caché de un mes concreto sin emitir eventos.
 * En Fase 1 NO lo usamos aún, pero es útil para mantener responsabilidades claras.
 */
export function deleteCachedAvailability(year: number, month: number) {
  availabilityCache.delete(toMonthKey(year, month));
}
