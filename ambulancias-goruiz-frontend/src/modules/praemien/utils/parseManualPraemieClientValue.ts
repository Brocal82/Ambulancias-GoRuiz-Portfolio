const MAX = 10_000;

/**
 * Alineado con el backend: 0…10000, hasta 2 decimales (p. ej. 1,5).
 */
export function parseManualPraemieClientValue(
  raw: string,
): { ok: true; value: number } | { ok: false } {
  const trimmed = String(raw).trim();
  if (trimmed === "") {
    return { ok: true, value: 0 };
  }
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > MAX) {
    return { ok: false };
  }
  return { ok: true, value: Math.round(n * 100) / 100 };
}
