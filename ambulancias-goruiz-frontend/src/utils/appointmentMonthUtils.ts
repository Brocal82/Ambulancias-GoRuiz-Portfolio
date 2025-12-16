// frontend/src/utils/appointmentMonthUtils.ts
import type { Appointment } from "../types/appointment";

export type DayKey = string; // 'YYYY-MM-DD'

/** Devuelve 'YYYY-MM-DD' calculado en una zona horaria (por defecto Europe/Berlin) */
export function ymd(date: Date, tz: string = "Europe/Berlin"): DayKey {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** Devuelve los 12 meses del año con label internacionalizado según el locale */
export function getYearMonths(year: number, locale: string = "es") {
  return Array.from({ length: 12 }).map((_, i) => ({
    monthIndex: i, // 0-11
    label: new Date(year, i, 1).toLocaleDateString(locale, { month: "long" }),
  }));
}

/** Cuenta cuántas citas confirmadas/reprogramadas hay por mes de un año */
export function countAppointmentsByMonth(
  appointments: Appointment[],
  year: number,
): number[] {
  const counts = Array(12).fill(0);
  for (const a of appointments) {
    const iso = a.selectedSlot?.start;
    if (!iso) continue;
    const d = new Date(iso);
    if (d.getFullYear() !== year) continue;
    counts[d.getMonth()] += 1;
  }
  return counts;
}

/** Construye la matriz de celdas para un mes (comienza en Lunes) */
export function getMonthMatrix(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
  const daysInMonth = last.getDate();

  const cells: Array<{ date: Date | null; dayNumber: number | null }> = [];
  for (let i = 0; i < firstWeekday; i++)
    cells.push({ date: null, dayNumber: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, monthIndex, d), dayNumber: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, dayNumber: null });
  return cells;
}

/** Agrupa citas confirmadas/reprogramadas por día 'YYYY-MM-DD' en TZ dada */
export function groupAppointmentsByDay(
  appointments: Appointment[],
  tz: string = "Europe/Berlin",
) {
  const map = new Map<DayKey, Appointment[]>();
  for (const a of appointments) {
    const start = a.selectedSlot?.start;
    if (!start) continue;
    const key = ymd(new Date(start), tz);
    const arr = map.get(key) ?? [];
    arr.push(a);
    map.set(key, arr);
  }
  return map;
}
