import type { IVacationRequest } from "../domain/types";
import { toBerlinDayKey } from "../../../utils/dates/dayKey";
import { getRequestRangeBerlin } from "./getRequestRangeBerlin";

function normalizeKeyRange(a: string, b: string) {
  return a <= b ? { startKey: a, endKey: b } : { startKey: b, endKey: a };
}

function monthKeyRange(year: number, monthIndex: number) {
  const startKey = toBerlinDayKey(new Date(year, monthIndex, 1, 12, 0, 0, 0));
  const endKey = toBerlinDayKey(new Date(year, monthIndex + 1, 0, 12, 0, 0, 0));
  return { startKey, endKey };
}

function keyRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Â¿Una solicitud solapa con el mes indicado del aÃ±o dado? */
export function requestOverlapsMonth(
  req: IVacationRequest,
  monthIndex: number,
  year: number = new Date().getFullYear(),
) {
  const { startKey: mStart, endKey: mEnd } = monthKeyRange(year, monthIndex);
  const { start, end } = getRequestRangeBerlin(req);

  const sKey = toBerlinDayKey(
    new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
  );
  const eKey = toBerlinDayKey(
    new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0),
  );

  if (!mStart || !mEnd || !sKey || !eKey) return false;

  const { startKey, endKey } = normalizeKeyRange(sKey, eKey);
  return keyRangesOverlap(startKey, endKey, mStart, mEnd);
}

/**
 * Devuelve un array de 12 contadores de solicitudes por mes (incluye solapes entre meses).
 * Optimizado: calcula los lÃ­mites de los 12 meses una sola vez.
 */
export function countRequestsByMonth(
  requests: IVacationRequest[],
  year: number = new Date().getFullYear(),
) {
  const counts = Array(12).fill(0) as number[];

  const monthRanges = Array.from({ length: 12 }, (_, m) => {
    const { startKey, endKey } = monthKeyRange(year, m);
    return { startKey, endKey };
  });

  for (const req of requests) {
    const { start, end } = getRequestRangeBerlin(req);

    const sKey = toBerlinDayKey(
      new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
    );
    const eKey = toBerlinDayKey(
      new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0),
    );

    if (!sKey || !eKey) continue;

    const { startKey, endKey } = normalizeKeyRange(sKey, eKey);

    for (let m = 0; m < 12; m++) {
      const mr = monthRanges[m];
      if (!mr.startKey || !mr.endKey) continue;

      if (keyRangesOverlap(startKey, endKey, mr.startKey, mr.endKey)) {
        counts[m]++;
      }
    }
  }

  return counts;
}

/** Filtra y devuelve las solicitudes que tocan el mes indicado */
export function filterRequestsByMonth(
  requests: IVacationRequest[],
  monthIndex: number,
  year: number = new Date().getFullYear(),
) {
  const { startKey: mStart, endKey: mEnd } = monthKeyRange(year, monthIndex);
  if (!mStart || !mEnd) return [];

  return requests.filter((req) => {
    const { start, end } = getRequestRangeBerlin(req);

    const sKey = toBerlinDayKey(
      new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0),
    );
    const eKey = toBerlinDayKey(
      new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0),
    );

    if (!sKey || !eKey) return false;

    const { startKey, endKey } = normalizeKeyRange(sKey, eKey);
    return keyRangesOverlap(startKey, endKey, mStart, mEnd);
  });
}
