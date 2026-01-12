/**
 * Devuelve true si `date` es anterior a "hoy" en hora local.
 * Comparación a nivel de día (00:00 local).
 */
export function isPastLocalDay(date: Date): boolean {
  const now = new Date();

  const today0 = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0
  );

  const d0 = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0, 0, 0, 0
  );

  return d0.getTime() < today0.getTime();
}
