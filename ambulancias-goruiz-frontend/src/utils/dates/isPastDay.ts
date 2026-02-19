// frontend/src/utils/dates/isPastDay.ts

import { toBerlinDayKey, todayBerlinDayKey } from "./dayKey";

/**
 * Devuelve true si isoDay (YYYY-MM-DD) es anterior a "hoy" en Europe/Berlin.
 * ✅ Consistente con el sistema DayKey (Berlin) para evitar bugs de timezone.
 */
export const isPastDay = (isoDay: string): boolean => {
  const dayKey = toBerlinDayKey(isoDay);
  const todayKey = todayBerlinDayKey();
  return dayKey < todayKey;
};

