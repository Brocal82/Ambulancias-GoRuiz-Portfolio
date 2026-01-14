// frontend/src/utils/dates/dayKey.ts

/**
 * DayKey: representación estable de un día calendario en Europe/Berlin.
 * Formato: "YYYY-MM-DD"
 *
 * ✅ Usar esto para:
 * - comparar días (pasado/futuro)
 * - rangos (vacaciones, disponibilidad)
 * - claves de mapa/set (por día)
 *
 * ❌ No usar para UI (para UI ya tienes timeUtils.ts).
 */

export type DayKey = `${number}-${string}-${string}`;

const TZ_BERLIN = "Europe/Berlin";

/**
 * Convierte Date | ISO string -> DayKey "YYYY-MM-DD" en zona horaria Europe/Berlin.
 *
 * Nota: usamos Intl.DateTimeFormat para “anclar” el día a Berlín,
 * evitando cambios por UTC o por el navegador.
 */
export function toBerlinDayKey(input: Date | string): DayKey {
  const d = typeof input === "string" ? new Date(input) : input;

  // Si llega algo inválido, devolvemos un fallback estable (y avisamos)
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    console.warn("[toBerlinDayKey] Invalid date input:", input);
    return "1970-01-01" as DayKey;
  }

  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  // Validación mínima de forma; si falla, fallback + aviso
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    console.warn("[toBerlinDayKey] Unexpected format:", ymd, "from input:", input);
    return "1970-01-01" as DayKey;
  }

  return ymd as DayKey;
}


/**
 * Devuelve el DayKey de "hoy" en Berlín.
 */
export function todayBerlinDayKey(): DayKey {
  const key = toBerlinDayKey(new Date());
  // En condiciones normales nunca será null
  return (key ?? "1970-01-01") as DayKey;
}

/**
 * Convierte un DayKey a Date "local" (00:00 local), solo para construir rangos/iterar.
 * Importante: el DayKey ya está anclado a Berlín, por eso esta Date solo se usa como soporte.
 */
export function dayKeyToLocalDate(dayKey: DayKey): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/**
 * Devuelve true si a < b (comparación lexicográfica funciona en YYYY-MM-DD).
 */
export function isDayKeyBefore(a: DayKey, b: DayKey): boolean {
  return a < b;
}

/**
 * Devuelve true si a === b.
 */
export function isSameDayKey(a: DayKey, b: DayKey): boolean {
  return a === b;
}
