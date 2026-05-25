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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea YYYY-MM-DD como inicio de día en Europe/Berlin.
 * Lanza Error si el formato o la fecha no son válidos.
 */
export function parseWeekStartISO(weekStartISO: string): DateTime {
  const trimmed = String(weekStartISO ?? "").trim();
  if (!ISO_DATE_RE.test(trimmed)) {
    throw new Error("Fecha de inicio inválida: use formato YYYY-MM-DD");
  }
  const dt = DateTime.fromISO(trimmed, { zone: ZONE }).startOf("day");
  if (!dt.isValid) {
    throw new Error("Fecha de inicio inválida");
  }
  return dt;
}

/**
 * Rango inclusivo [start, end] de weekStartDate en Mongo para una semana de 7 días
 * (lunes + 6 días), anclado a medianoche Berlin.
 */
export function getWeekMongoDateRange(weekStartISO: string): {
  start: Date;
  end: Date;
  weekDates: string[];
} {
  const startDt = parseWeekStartISO(weekStartISO);
  const endDt = startDt.plus({ days: 6 }).startOf("day");
  return {
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    weekDates: buildWeekDateStrings(startDt.toISODate()!),
  };
}
