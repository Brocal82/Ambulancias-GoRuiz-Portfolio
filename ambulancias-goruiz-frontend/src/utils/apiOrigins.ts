// src/utils/apiOrigin.ts
// Toma VITE_API_URL (p.ej. https://ambulancias-goruiz.onrender.com/api)
// y saca el "origin" del backend: https://ambulancias-goruiz.onrender.com
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

// Construye URL absoluta para imágenes/alojadas en /uploads
export function buildImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";

  // Si ya es absoluta y NO es localhost, la devolvemos tal cual
  if (/^https?:\/\//i.test(pathOrUrl) && !/localhost:5000/i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  // Si venía de la BD con localhost, lo sustituimos por el dominio de Render
  const sanitized = pathOrUrl.replace(/^https?:\/\/localhost:5000/i, API_ORIGIN);

  // Si empieza por /uploads, la unimos al origen
  if (sanitized.startsWith("/uploads")) {
    return `${API_ORIGIN}${sanitized}`;
  }

  // Si solo es un nombre de archivo, la llevamos a /uploads
  return `${API_ORIGIN}/uploads/${sanitized}`;
}
