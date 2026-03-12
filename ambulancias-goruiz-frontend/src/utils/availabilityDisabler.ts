// src/utils/availabilityDisabler.ts
import {
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from "../modules/vacation/domain/api";

/** Carga disponibilidad de varios meses y devuelve un mapa YYYY-MM -> Availability */
export async function preloadAvailabilityMonths(
  pairs: Array<{ y: number; m1: number }>,
) {
  const byMonth: Record<string, VacationAvailabilityResponse> = {};
  for (const p of pairs) {
    const key = `${p.y}-${String(p.m1).padStart(2, "0")}`;
    if (byMonth[key]) continue;
    try {
      byMonth[key] = await getVacationAvailability({ year: p.y, month: p.m1 });
    } catch {
      // silencioso: si falla, no deshabilitamos esos días
    }
  }
  return byMonth;
}

/** Construye una función que deshabilita días con state === 'red' */
export function buildIsDateDisabled(
  availByMonth: Record<string, VacationAvailabilityResponse>,
) {
  return (d: Date) => {
    const y = d.getFullYear();
    const m1 = d.getMonth() + 1;
    const key = `${y}-${String(m1).padStart(2, "0")}`;
    const avail = availByMonth[key];
    if (!avail) return false;
    const rec = avail.days.find((x) => x.day === d.getDate());
    return rec?.state === "red";
  };
}

