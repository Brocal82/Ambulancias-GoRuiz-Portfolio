// src/utils/vacationMonthUtils.ts
import type { IVacationRequest } from '../types/vacationRequest';

/**
 * Devuelve los 12 meses del año con:
 * - monthIndex: 0..11
 * - label: nombre del mes localizado (es-ES)
 * - start/end: límites del mes en la zona Europe/Berlin
 */
export function getYearMonths(year: number = new Date().getFullYear()) {
  const months = Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1, 0, 0, 0, 0);
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999); // último día del mes
    const label = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      timeZone: 'Europe/Berlin',
    }).format(start);

    return {
      monthIndex: m,
      label: label.charAt(0).toUpperCase() + label.slice(1), // "Enero"
      start,
      end,
    };
  });

  return months;
}

/** Comprueba si dos rangos [aStart, aEnd] y [bStart, bEnd] se solapan */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** ¿Una solicitud solapa con el mes indicado del año dado? */
export function requestOverlapsMonth(
  req: IVacationRequest,
  monthIndex: number,
  year: number = new Date().getFullYear()
) {
  const { start, end } = getYearMonths(year)[monthIndex];
  const rStart = new Date(req.startDate);
  const rEnd = new Date(req.endDate);
  return rangesOverlap(rStart, rEnd, start, end);
}

/** Devuelve un array de 12 contadores de solicitudes por mes (incluye solapes entre meses) */
export function countRequestsByMonth(
  requests: IVacationRequest[],
  year: number = new Date().getFullYear()
) {
  const counts = Array(12).fill(0) as number[];
  for (const req of requests) {
    for (let m = 0; m < 12; m++) {
      if (requestOverlapsMonth(req, m, year)) counts[m]++;
    }
  }
  return counts;
}

/** Filtra y devuelve las solicitudes que tocan el mes indicado */
export function filterRequestsByMonth(
  requests: IVacationRequest[],
  monthIndex: number,
  year: number = new Date().getFullYear()
) {
  return requests.filter(req => requestOverlapsMonth(req, monthIndex, year));
}
