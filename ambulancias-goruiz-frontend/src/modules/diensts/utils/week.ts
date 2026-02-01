// frontend/src/modules/diensts/utils/week.ts
import { dayKeyToLocalDate, toBerlinDayKey, type DayKey } from "../../../utils/dates/dayKey";

/**
 * Devuelve el lunes (weekStart) de la semana ISO para un DayKey dado.
 * ISO: lunes = primer día de la semana.
 */
export function mondayOfISOWeek(day: DayKey): DayKey {
  const d = dayKeyToLocalDate(day); // 00:00 local (solo para iterar)
  const jsDay = d.getDay(); // 0=Sun,1=Mon,...6=Sat
  const diff = jsDay === 0 ? -6 : 1 - jsDay; // mueve a lunes
  d.setDate(d.getDate() + diff);
  return toBerlinDayKey(d);
}

/**
 * Suma N días a un DayKey y devuelve DayKey (Berlin-safe).
 */
export function addDaysToDayKey(day: DayKey, days: number): DayKey {
  const d = dayKeyToLocalDate(day);
  d.setDate(d.getDate() + days);
  return toBerlinDayKey(d);
}

/**
 * Devuelve 3 inicios de semana (lunes) a partir de la semana actual en Berlín:
 * [esta semana, siguiente, siguiente+1]
 */
export function getWeekStartsBerlin(count: number = 3): DayKey[] {
  const today = toBerlinDayKey(new Date());
  const monday = mondayOfISOWeek(today);
  return Array.from({ length: count }, (_, i) => addDaysToDayKey(monday, i * 7));
}

/**
 * Devuelve los 7 días (DayKey) de la semana, a partir del lunes.
 */
export function getWeekDays(weekStart: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDayKey(weekStart, i));
}
