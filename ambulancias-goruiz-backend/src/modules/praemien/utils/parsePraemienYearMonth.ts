export class PraemienValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PraemienValidationError";
  }
}

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

function coerceFiniteInteger(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw.trim());
  return Number(raw);
}

function isBlankQueryValue(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === "";
}

/**
 * Strict year/month parsing for save-monthly and manual month queries.
 * Does not fall back to the current calendar date.
 */
export function parsePraemienYearMonth(
  yearRaw: unknown,
  monthRaw: unknown,
): { year: number; month: number } {
  if (isBlankQueryValue(yearRaw) || isBlankQueryValue(monthRaw)) {
    throw new PraemienValidationError(
      "Los parámetros year y month son obligatorios.",
    );
  }

  const year = coerceFiniteInteger(yearRaw);
  const month = coerceFiniteInteger(monthRaw);

  if (!Number.isFinite(year) || !Number.isInteger(year)) {
    throw new PraemienValidationError("Año inválido.");
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new PraemienValidationError("Año fuera de rango.");
  }

  if (!Number.isFinite(month) || !Number.isInteger(month)) {
    throw new PraemienValidationError("Mes inválido.");
  }
  if (month < 1 || month > 12) {
    throw new PraemienValidationError("Mes fuera de rango (1-12).");
  }

  return { year, month };
}

/** Shared bounds check used by manual daily services. */
export function isValidPraemienYearMonth(year: number, month: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  );
}
