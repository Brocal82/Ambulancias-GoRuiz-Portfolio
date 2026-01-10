// frontend/src/utils/vacation/invalidateAvailabilityForRange.ts
import { emitAvailabilityInvalidated } from "./vacationEvents";

/**
 * Emite invalidación de disponibilidad para TODOS los meses afectados por un rango ISO.
 * - startISO / endISO: strings tipo "2026-01-10T00:00:00.000Z"
 * - Emite emitAvailabilityInvalidated({ year, month }) por cada mes (month 1..12)
 *
 * Regla del módulo:
 * - Nadie más calcula meses.
 * - Nadie más emite availability-invalidated suelto.
 */
export function invalidateAvailabilityForRange(startISO: string, endISO: string) {
  if (!startISO || !endISO) return;

  const start = new Date(startISO);
  const end = new Date(endISO);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  // Normalizamos para evitar problemas si vienen invertidas
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;

  let y = s.getFullYear();
  let m0 = s.getMonth(); // 0..11

  const endY = e.getFullYear();
  const endM0 = e.getMonth();

  while (y < endY || (y === endY && m0 <= endM0)) {
    emitAvailabilityInvalidated({ year: y, month: m0 + 1 }); // month 1..12

    m0++;
    if (m0 > 11) {
      m0 = 0;
      y++;
    }
  }
}
