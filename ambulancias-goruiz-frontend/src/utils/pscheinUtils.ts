// frontend/src/utils/pscheinUtils.ts
export type PscheinStatus = "valid" | "warning" | "expired" | "no-date";

export function getPscheinInfo(date?: string): {
  status: PscheinStatus;
  monthsLeft?: number; // puede ser negativo si ya caducÃ³
  daysLeft?: number; // idem
} {
  if (!date) return { status: "no-date" };

  const expiry = new Date(date);
  if (isNaN(expiry.getTime())) return { status: "no-date" };

  const now = new Date();

  const msDiff = expiry.getTime() - now.getTime();
  const daysLeft = Math.round(msDiff / (1000 * 60 * 60 * 24));
  const monthsLeft = Math.round(daysLeft / 30.44);

  if (expiry < now) {
    return { status: "expired", monthsLeft, daysLeft };
  }

  if (monthsLeft <= 6) {
    return { status: "warning", monthsLeft, daysLeft };
  }

  return { status: "valid", monthsLeft, daysLeft };
}

/** UTC midnight for YYYY-MM-DD prefix — aligns with backend / driverEligibility calendar-day P-Schein validity. */
function utcMsYMD(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Same as {@link getPscheinInfo} but validity/warning are evaluated against `asOfDateISO` (YYYY-MM-DD), not wall-clock now. */
export function getPscheinInfoAsOfDate(
  expiryDate?: string,
  asOfDateISO?: string,
): {
  status: PscheinStatus;
  monthsLeft?: number;
  daysLeft?: number;
} {
  if (!expiryDate || !asOfDateISO?.trim()) return { status: "no-date" };

  const expMs = utcMsYMD(expiryDate);
  const asOfMs = utcMsYMD(asOfDateISO);
  if (expMs == null || asOfMs == null) return { status: "no-date" };

  const DAY = 86400000;
  const daysLeft = Math.round((expMs - asOfMs) / DAY);
  const monthsLeft = Math.round(daysLeft / 30.44);

  // Expiry is valid through the whole expiry calendar day (same rule as Phase 3A / isPscheinExpiryValidOnAssignmentDate).
  if (asOfMs > expMs) {
    return { status: "expired", monthsLeft, daysLeft };
  }

  if (monthsLeft <= 6) {
    return { status: "warning", monthsLeft, daysLeft };
  }

  return { status: "valid", monthsLeft, daysLeft };
}

/**
 * Devuelve el tÃ­tulo del tooltip para P-Schein warning o expirado.
 * Usa la traducciÃ³n con conteo de meses.
 *
 * @param pscheinExpiry ISO string (YYYY-MM-DD)
 * @param t funciÃ³n de traducciÃ³n i18n
 */
export function getPscheinWarningTitle(
  pscheinExpiry?: string,
  t?: (key: string, vars?: any) => string,
): string {
  const info = getPscheinInfo(pscheinExpiry);

  if (info.status === "expired") {
    return t
      ? t("pages.diensts.adminPage.driverPscheinExpired", "P-Schein caducado")
      : "P-Schein caducado";
  }

  if (info.status === "warning" && typeof info.monthsLeft === "number") {
    return t
      ? t("pages.diensts.adminPage.driverPscheinWarning", {
          count: info.monthsLeft,
        })
      : `P-Schein caduca en ${info.monthsLeft} meses`;
  }

  return "";
}
