export type PscheinStatus = 'valid' | 'warning' | 'expired' | 'no-date';

export function getPscheinStatus(date?: string): PscheinStatus {
  if (!date) return 'no-date';

  const expiry = new Date(date);
  const now = new Date();

  if (expiry < now) return 'expired';

  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(now.getMonth() + 6);

  if (expiry < sixMonthsFromNow) return 'warning';

  return 'valid';
}
