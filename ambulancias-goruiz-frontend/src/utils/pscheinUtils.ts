// frontend/src/utils/pscheinUtils.ts
export type PscheinStatus = 'valid' | 'warning' | 'expired' | 'no-date';

export function getPscheinInfo(date?: string): {
  status: PscheinStatus;
  monthsLeft?: number; // puede ser negativo si ya caducó
  daysLeft?: number;   // idem
} {
  if (!date) return { status: 'no-date' };

  const expiry = new Date(date);
  if (isNaN(expiry.getTime())) return { status: 'no-date' };

  const now = new Date();

  // Diferencias “aprox” por meses y días
  const msDiff = expiry.getTime() - now.getTime();
  const daysLeft = Math.round(msDiff / (1000 * 60 * 60 * 24));

  // Aproximación de meses (30.44 días promedio)
  const monthsLeft = Math.round(daysLeft / 30.44);

  if (expiry < now) {
    return { status: 'expired', monthsLeft, daysLeft };
  }

  // Warning si faltan ≤ 6 meses
  if (monthsLeft <= 6) {
    return { status: 'warning', monthsLeft, daysLeft };
  }

  return { status: 'valid', monthsLeft, daysLeft };
}
