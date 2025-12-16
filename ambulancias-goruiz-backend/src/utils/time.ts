// backend/src/utils/time.ts
import { DateTime } from "luxon";

export const ZONE = "Europe/Berlin";

/**
 * Devuelve los 7 días (YYYY-MM-DD) de la semana a partir de weekStartISO (lunes).
 */
export function buildWeekDateStrings(weekStartISO: string): string[] {
  const start = DateTime.fromISO(weekStartISO, { zone: ZONE }).startOf("day");
  return Array.from(
    { length: 7 },
    (_, i) => start.plus({ days: i }).toISODate()!,
  );
}

/**
 * Convierte dateISO + "HH:mm" a DateTime en ZONE.
 */
export function toZonedDateTime(
  dateISO: string,
  timeHHmm: string,
  zone: string = ZONE,
): DateTime {
  const [h, m] = (timeHHmm ?? "00:00").split(":").map((v) => Number(v) || 0);
  return DateTime.fromISO(dateISO, { zone }).set({
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });
}

/**
 * Dado un turno (dateISO, startHHmm, endHHmm) devuelve { start, end } en ZONE.
 * Si end <= start, asumimos cruce de medianoche y sumamos 1 día al final.
 */
export function computeShiftBounds(
  dateISO: string,
  startHHmm: string,
  endHHmm: string,
  zone: string = ZONE,
): { start: DateTime; end: DateTime } {
  const start = toZonedDateTime(dateISO, startHHmm, zone);
  let end = toZonedDateTime(dateISO, endHHmm, zone);
  if (end <= start) end = end.plus({ days: 1 });
  return { start, end };
}

/**
 * Minutos entre dos DateTime.
 */
export function diffMinutes(a: DateTime, b: DateTime): number {
  return Math.round(b.diff(a, "minutes").minutes);
}
