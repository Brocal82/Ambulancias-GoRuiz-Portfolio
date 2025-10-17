// backend/src/utils/overlap.ts
import { computeShiftBounds } from './time';

/**
 * Comprueba si dos turnos (cada uno con dateISO + start/end HH:mm) se solapan.
 */
export function shiftsOverlap(
  a: { date: string; startTime: string; endTime: string },
  b: { date: string; startTime: string; endTime: string }
): boolean {
  if (!a?.date || !a?.startTime || !a?.endTime) return false;
  if (!b?.date || !b?.startTime || !b?.endTime) return false;

  const A = computeShiftBounds(a.date, a.startTime, a.endTime);
  const B = computeShiftBounds(b.date, b.startTime, b.endTime);

  // [A.start, A.end) y [B.start, B.end) se solapan si hay intersección no vacía
  return A.start < B.end && B.start < A.end;
}
