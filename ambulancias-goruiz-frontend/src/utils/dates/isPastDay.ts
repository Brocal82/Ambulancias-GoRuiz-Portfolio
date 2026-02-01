// frontend/src/utils/dates/isPastDay.ts

/**
 * Devuelve true si isoDay (YYYY-MM-DD) es ANTERIOR a "hoy" (en hora local).
 * Usamos T12:00:00 para evitar desajustes por UTC.
 */
export const isPastDay = (isoDay: string): boolean => {
  const d = new Date(`${isoDay}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return d.getTime() < today.getTime();
};
