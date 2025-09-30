export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function buildImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  // Si ya es absoluta y no es localhost, devuélvela
  if (/^https?:\/\//i.test(pathOrUrl) && !/localhost:5000/i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  // Sustituye localhost por el origin correcto
  const sanitized = pathOrUrl.replace(/^https?:\/\/localhost:5000/i, API_ORIGIN);
  // Si empieza por /uploads, unir al origin
  if (sanitized.startsWith('/uploads')) return `${API_ORIGIN}${sanitized}`;
  // Si es nombre/relativa, asumir /uploads
  return `${API_ORIGIN}/uploads/${sanitized}`;
}
