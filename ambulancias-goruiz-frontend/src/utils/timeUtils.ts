// src/utils/timeUtils.ts

/** Devuelve la hora actual como 'HH:mm' */
export const getCurrentTimeString = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

/** Convierte una fecha ISO (o YYYY-MM-DD) a 'DD-MM-YYYY' usando Europe/Berlin */
export function formatISOToDDMMYYYY(iso?: string): string {
  if (!iso) return "";

  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  // Formateo estable con TZ Berlin
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";

  if (!day || !month || !year) return "";

  return `${day}-${month}-${year}`;
}


/** Convierte una fecha 'YYYY-MM-DD' a 'DD-MM-YYYY' */
export function formatYYYYMMDDToDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
}

/**
 * Convierte 'YYYY-MM-DD' → 'DD/MM'
 * ✅ Usar este formato para tooltips de vacaciones y bajas.
 */
export function fmtDDMM(dateStr?: string): string {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  if (!m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}`;
}

/**
 * Formato unificado SOLO para la cuadrícula de días del Admin:
 * - Muestra el nombre del día en el idioma actual (Dom / So / Sun)
 * - Siempre usa DD/MM (02/11) como parte numérica, sin importar el idioma
 * - Ejemplos: "dom, 02/11" | "So, 02/11" | "Sun, 02/11"
 */
export function formatCellDateUnified(isoDay: string, lang: string): string {
  const d = new Date(isoDay);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  // Elegimos locale solo para el nombre del día
  const locale = lang?.startsWith("de")
    ? "de-DE"
    : lang?.startsWith("en")
      ? "en-US"
      : "es-ES";

  // Nombre del día abreviado según idioma, sin punto final (de pone "So.")
  const rawWk = new Intl.DateTimeFormat(locale, { weekday: "short" })
    .format(d)
    .trim();
  const wk = rawWk.replace(/\.$/, "");

  return `${wk}, ${dd}/${mm}`;
}
