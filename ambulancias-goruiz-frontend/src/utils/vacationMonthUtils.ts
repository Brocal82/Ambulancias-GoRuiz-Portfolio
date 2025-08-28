// src/utils/vacationMonthUtils.ts
import type { IVacationRequest } from '../types/vacationRequest';

export type MonthInfo = {
  monthIndex: number; // 0..11
  label: string;      // nombre del mes localizado según `locale`
  start: Date;        // inicio del mes (00:00:00.000)
  end: Date;          // fin del mes (23:59:59.999)
};

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
  locale: string = 'es',
  tz: string = 'Europe/Berlin'
): MonthInfo[] {
  return Array.from({ length: 12 }, (_, m) => {
    const start = new Date(year, m, 1, 0, 0, 0, 0);
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999); // último día del mes
    const label = new Intl.DateTimeFormat(locale, {
      month: 'long',
      timeZone: tz,
    }).format(start);

    return { monthIndex: m, label, start, end };
  });
}

/** Comprueba si dos rangos [aStart, aEnd] y [bStart, bEnd] se solapan */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
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
  tz: string = 'Europe/Berlin'
) {
  const { start, end } = getYearMonths(year, undefined, tz)[monthIndex];
  const rStart = new Date(req.startDate);
  const rEnd = new Date(req.endDate);
  return rangesOverlap(rStart, rEnd, start, end);
}

/**
 * Devuelve un array de 12 contadores de solicitudes por mes (incluye solapes entre meses).
 * Optimizado: calcula los límites de los 12 meses una sola vez.
 */
export function countRequestsByMonth(
  requests: IVacationRequest[],
  year: number = new Date().getFullYear(),
  tz: string = 'Europe/Berlin'
) {
  const months = getYearMonths(year, undefined, tz);
  const counts = Array(12).fill(0) as number[];

  for (const req of requests) {
    const rStart = new Date(req.startDate);
    const rEnd = new Date(req.endDate);
    for (let m = 0; m < 12; m++) {
      const { start, end } = months[m];
      if (rangesOverlap(rStart, rEnd, start, end)) counts[m]++;
    }
  }
  return counts;
}

/** Filtra y devuelve las solicitudes que tocan el mes indicado */
export function filterRequestsByMonth(
  requests: IVacationRequest[],
  monthIndex: number,
  year: number = new Date().getFullYear(),
  tz: string = 'Europe/Berlin'
) {
  const { start, end } = getYearMonths(year, undefined, tz)[monthIndex];
  return requests.filter(req =>
    rangesOverlap(new Date(req.startDate), new Date(req.endDate), start, end)
  );
}
