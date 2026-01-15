// frontend/src/utils/vacation/invalidateAvailabilityByRangeBerlin.ts
import { emitAvailabilityInvalidated } from "./vacationEvents";

/**
 * Calcula e invalida meses afectados por un rango ISO usando TZ Europe/Berlin.
 *
 * ⚠️ Fase 1:
 * - Copia literal del comportamiento previo que vivía en api/vacation.ts
 * - No cambiar la lógica (anti-rotura)
 * - Prepara el terreno para unificar con invalidateAvailabilityForRange en fases futuras
 */

function getBerlinYearMonth(iso: string): { y: number; m1: number } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const y = Number(
    d.toLocaleString("en-CA", { year: "numeric", timeZone: "Europe/Berlin" }),
  );
  const m1 = Number(
    d.toLocaleString("en-CA", { month: "2-digit", timeZone: "Europe/Berlin" }),
  );

  if (!y || !m1) return null;
  return { y, m1 };
}

export function invalidateAvailabilityByRangeBerlin(startISO: string, endISO: string) {
  const startYM = getBerlinYearMonth(startISO);
  const endYM = getBerlinYearMonth(endISO);
  if (!startYM || !endYM) return;

  // Iteramos meses entre startYM y endYM, ambos inclusive (en "Berlin")
  let y = startYM.y;
  let m1 = startYM.m1; // 1..12

  const endY = endYM.y;
  const endM1 = endYM.m1;

  while (y < endY || (y === endY && m1 <= endM1)) {
    emitAvailabilityInvalidated({ year: y, month: m1 }); // month 1..12

    m1++;
    if (m1 > 12) {
      m1 = 1;
      y++;
    }
  }
}
