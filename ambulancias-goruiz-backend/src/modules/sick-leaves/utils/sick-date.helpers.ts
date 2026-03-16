import { DateTime } from "luxon";

const ZONE = "Europe/Berlin";

export function toBerlinDay(dateISO: string, endOfDay = false): Date {
  const dt = DateTime.fromISO(dateISO, { zone: ZONE });
  return (endOfDay ? dt.endOf("day") : dt.startOf("day")).toJSDate();
}

export function formatBerlinYmd(date: Date): string {
  return DateTime.fromJSDate(date, { zone: ZONE }).toFormat("yyyy-LL-dd");
}

export function toBerlinStartOfDay(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: ZONE }).startOf("day");
}

export function toBerlinEndOfDay(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: ZONE }).endOf("day");
}

export function toBerlinDateTime(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: ZONE });
}
