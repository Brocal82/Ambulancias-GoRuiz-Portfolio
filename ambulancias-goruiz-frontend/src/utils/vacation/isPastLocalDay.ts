// frontend/src/utils/vacation/isPastLocalDay.ts
import { toBerlinDayKey, todayBerlinDayKey } from "../dates/dayKey";

/**
 * Devuelve true si `date` es anterior a "hoy" en TZ Europe/Berlin,
 * comparando por DayKey (YYYY-MM-DD).
 *
 * Nota:
 * - Mantenemos el nombre del archivo/función para NO romper imports existentes.
 * - Internamente ya NO usa "hora local del navegador".
 */
export function isPastLocalDay(date: Date): boolean {
  const dKey = toBerlinDayKey(date);
  const todayKey = todayBerlinDayKey();

  if (!dKey || !todayKey) return false;

  return dKey < todayKey;
}
