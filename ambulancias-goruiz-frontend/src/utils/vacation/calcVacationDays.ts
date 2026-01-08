// frontend/src/utils/vacation/calcVacationDays.ts

/**
 * Calcula número de días naturales entre dos fechas ISO (inclusive).
 * Devuelve "—" si el rango es inválido.
 */
export function calcVacationDays(
  startISO: string,
  endISO: string,
): number | "—" {
  const s = new Date(startISO);
  const e = new Date(endISO);

  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "—";

  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);

  const diff =
    Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;

  return Number.isNaN(diff) ? "—" : Math.max(diff, 1);
}
