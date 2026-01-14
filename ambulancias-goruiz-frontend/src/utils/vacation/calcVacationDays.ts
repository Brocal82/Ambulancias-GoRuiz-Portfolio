// frontend/src/utils/vacation/calcVacationDays.ts
import { dayKeyToLocalDate, toBerlinDayKey } from "../dates/dayKey";

/**
 * Calcula número de días naturales entre dos fechas ISO (inclusive),
 * anclado a día calendario en Europe/Berlin.
 *
 * Devuelve "—" si el rango es inválido.
 */
export function calcVacationDays(
  startISO: string,
  endISO: string,
): number | "—" {
  const sKey = toBerlinDayKey(startISO);
  const eKey = toBerlinDayKey(endISO);

  if (!sKey || !eKey) return "—";

  // Si están invertidas, lo normal es devolver "—" o 1. Mantenemos "—" para rangos inválidos.
  if (eKey < sKey) return "—";

  const s = dayKeyToLocalDate(sKey);
  const e = dayKeyToLocalDate(eKey);

  const msPerDay = 86_400_000;
  const startUTC = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const endUTC = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());

  const diff = Math.floor((endUTC - startUTC) / msPerDay) + 1;

  return Number.isNaN(diff) ? "—" : Math.max(diff, 1);
}
