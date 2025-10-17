export type PscheinStatus = 'valid' | 'warning' | 'expired' | 'no-date';

export interface PscheinInfo {
  status: PscheinStatus;
  /** Meses ENTEROS que faltan (>= 0). Por compatibilidad visual. */
  monthsLeft?: number;
  /** Días TOTALES que faltan (>= 0). Útil para precisión. */
  daysLeft?: number;
  /** ISO de caducidad (si viene). */
  isoExpiry?: string;
}

/** Lee el umbral de aviso desde ENV, por defecto 6 meses */
function getWarningThresholdMonths(): number {
  const raw = process.env.PSCHEIN_WARNING_MONTHS;
  const n = raw ? Number(raw) : 6;
  return Number.isFinite(n) && n >= 0 ? n : 6;
}

/** Suma meses manteniendo fin de mes cuando procede */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // Ajuste fin de mes (p.ej., sumar 1 mes a 31-01 -> 28/29-02)
  while (d.getDate() < day) {
    d.setDate(d.getDate() + 1);
    if (d.getDate() === day) break;
    if (d.getMonth() === (date.getMonth() + months + 1) % 12) break;
  }
  return d;
}

/** Diferencia en días (ceil) entre dos fechas */
function diffDaysCeil(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Meses ENTEROS hasta la fecha (floor), ajustando por día del mes */
function wholeMonthsUntil(expiry: Date, from: Date): number {
  let months = (expiry.getFullYear() - from.getFullYear()) * 12 + (expiry.getMonth() - from.getMonth());
  // Si el “día” de expiry todavía no ha llegado este mes, restamos 1
  if (expiry.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Nueva función enriquecida:
 * - status: 'valid' | 'warning' | 'expired' | 'no-date'
 * - monthsLeft: meses ENTEROS restantes (>=0)
 * - daysLeft: días totales restantes (>=0, ceil)
 */
export function getPscheinInfo(date?: string): PscheinInfo {
  if (!date) return { status: 'no-date' };

  const expiry = new Date(date);
  if (Number.isNaN(expiry.getTime())) return { status: 'no-date' };

  const now = new Date();

  if (expiry < now) {
    return {
      status: 'expired',
      monthsLeft: 0,
      daysLeft: 0,
      isoExpiry: expiry.toISOString(),
    };
  }

  const monthsLeft = wholeMonthsUntil(expiry, now);
  const daysLeft = diffDaysCeil(expiry, now);
  const threshold = getWarningThresholdMonths();

  const status: PscheinStatus = monthsLeft <= threshold ? 'warning' : 'valid';

  return { status, monthsLeft, daysLeft, isoExpiry: expiry.toISOString() };
}

/**
 * Mantengo la función antigua por compatibilidad.
 * Internamente usa el umbral dinámico (ENV) y la lógica de getPscheinInfo.
 */
export function getPscheinStatus(date?: string): PscheinStatus {
  const info = getPscheinInfo(date);
  return info.status;
}
