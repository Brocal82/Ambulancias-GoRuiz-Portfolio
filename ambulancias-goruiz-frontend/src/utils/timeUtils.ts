// src/utils/timeUtils.ts

/** Devuelve la hora actual como 'HH:mm' */
export const getCurrentTimeString = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

/** Convierte una fecha ISO a 'DD-MM-YYYY' */
export function formatISOToDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Convierte una fecha 'YYYY-MM-DD' a 'DD-MM-YYYY' */
export function formatYYYYMMDDToDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}
