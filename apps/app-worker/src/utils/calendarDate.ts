/** Sick-leave API dates are stored in Europe/Berlin calendar days. */
export const BERLIN_CALENDAR_TIME_ZONE = "Europe/Berlin";

/**
 * Normalizes API date strings to `yyyy-MM-dd` for display and inclusive day counts.
 * ISO datetimes must not be sliced by UTC (e.g. Berlin midnight → previous UTC day).
 */
export function calendarDateFromApi(value: string): string {
  const trimmed = (value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  return parsed.toLocaleDateString("en-CA", { timeZone: BERLIN_CALENDAR_TIME_ZONE });
}

/** Inclusive calendar-day count between two Berlin `yyyy-MM-dd` keys. */
export function inclusiveCalendarDayCount(start: string, end: string): number {
  const startKey = calendarDateFromApi(start);
  const endKey = calendarDateFromApi(end);
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const startUtc = Date.UTC(sy, (sm ?? 1) - 1, sd ?? 1);
  const endUtc = Date.UTC(ey, (em ?? 1) - 1, ed ?? 1);
  const diff = endUtc - startUtc;
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}
