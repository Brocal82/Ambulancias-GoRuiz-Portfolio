export type MonthInfo = {
  monthIndex: number; // 0..11
  label: string; // nombre del mes localizado segÃºn `locale`
  start: Date; // inicio del mes (00:00:00.000)
  end: Date; // fin del mes (23:59:59.999)
};

/**
 * Devuelve los 12 meses del aÃ±o con:
 * - monthIndex: 0..11
 * - label: nombre del mes localizado segÃºn `locale`
 * - start/end: lÃ­mites del mes (usa TZ lÃ³gica de Berlin para coherencia de negocio)
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
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
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

/** Devuelve los pares de { y, m1 } (1..2 meses) que abarca un rango */
export function monthsForRange(start: Date, end: Date) {
  const s = { y: start.getFullYear(), m1: start.getMonth() + 1 };
  const e = { y: end.getFullYear(), m1: end.getMonth() + 1 };
  return s.y === e.y && s.m1 === e.m1 ? [s] : [s, e];
}
