// src/utils/vacationMonthUtils.ts
import type { IVacationRequest } from "../types/vacationRequest";
import { toBerlinDayKey } from "./dates/dayKey";
import { getRequestRangeBerlin } from "./vacation/getRequestRangeBerlin";

export type MonthInfo = {
  monthIndex: number; // 0..11
  label: string; // nombre del mes localizado según `locale`
  start: Date; // inicio del mes (00:00:00.000)
  end: Date; // fin del mes (23:59:59.999)
};

function normalizeKeyRange(a: string, b: string) {
  return a <= b ? { startKey: a, endKey: b } : { startKey: b, endKey: a };
}

function monthKeyRange(year: number, monthIndex: number) {
  // Usamos 12:00 para evitar edge cases de DST al convertir a dayKey
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


/**
 * Devuelve los 12 meses del año con:
 * - monthIndex: 0..11
 * - label: nombre del mes localizado según `locale`
 * - start/end: límites del mes (usa TZ lógica de Berlin para coherencia de negocio)
 *
 * Nota: `label` respeta el casing del idioma; si quieres capitalizar, hazlo en UI (CSS).
 */
export function getYearMonths(
  year: number = new Date().getFullYear(),
  locale: string = "es",
  tz: string = "Europe/Berlin",
): MonthInfo[] {
  return Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1, 0, 0, 0, 0);
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999); // último día del mes
    const label = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: tz,
    }).format(start);

    return { monthIndex: m, label, start, end };
  });
}

/** Comprueba si dos rangos [aStart, aEnd] y [bStart, bEnd] se solapan */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) {
  return aStart <= bEnd && bStart <= aEnd;
}


/**
 * ¿Una solicitud solapa con el mes indicado del año dado?
 * Mantiene la firma original; usa internamente `getYearMonths`.
 */
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
 * Optimizado: calcula los límites de los 12 meses una sola vez.
 */
export function countRequestsByMonth(
  requests: IVacationRequest[],
  year: number = new Date().getFullYear(),
) {
  const counts = Array(12).fill(0) as number[];

  // Precalcular rangos por mes en dayKey
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


/** Devuelve los pares de { y, m1 } (1..2 meses) que abarca un rango */
export function monthsForRange(start: Date, end: Date) {
  const s = { y: start.getFullYear(), m1: start.getMonth() + 1 };
  const e = { y: end.getFullYear(), m1: end.getMonth() + 1 };
  return s.y === e.y && s.m1 === e.m1 ? [s] : [s, e];
}
