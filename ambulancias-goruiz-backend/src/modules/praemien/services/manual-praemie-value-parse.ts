/** Límite superior alineado con el modelo (pacientes / viajes efectivos). */
export const MAX_MANUAL_PRAEMIE_VALUE = 10_000;

/**
 * Acepta decimales (p. ej. 1.5). Normaliza a 2 decimales para evitar ruido float.
 */
export function parseManualPraemieNumericValue(raw: unknown):
  | { ok: true; value: number }
  | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, message: "Valor requerido." };
  }
  if (typeof raw === "string" && !raw.trim()) {
    return { ok: true, value: 0 };
  }
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(String(raw).trim().replace(",", "."))
        : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_MANUAL_PRAEMIE_VALUE) {
    return {
      ok: false,
      message: `El valor debe ser un número entre 0 y ${MAX_MANUAL_PRAEMIE_VALUE} (hasta 2 decimales, p. ej. 1,5).`,
    };
  }
  const value = Math.round(n * 100) / 100;
  if (value > MAX_MANUAL_PRAEMIE_VALUE) {
    return { ok: false, message: "Valor demasiado alto." };
  }
  return { ok: true, value };
}
