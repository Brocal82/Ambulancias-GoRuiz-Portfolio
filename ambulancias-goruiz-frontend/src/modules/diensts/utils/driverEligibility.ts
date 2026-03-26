import type { AmbulanceRole } from "../../users/domain/types";

export function isAmbulanceRoleDriverCapable(
  role: AmbulanceRole | undefined,
): boolean {
  return role === "driver" || role === "both";
}

function utcMsYMD(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Calendar-day comparison aligned with backend assignment date vs expiry (YYYY-MM-DD). */
export function isPscheinExpiryValidOnAssignmentDate(
  pscheinExpiry: string,
  assignmentDateISO: string,
): boolean {
  const e = utcMsYMD(pscheinExpiry);
  const a = utcMsYMD(assignmentDateISO);
  if (e == null || a == null) return false;
  return e >= a;
}

type DriverEligibilityUser = {
  ambulanceRole?: AmbulanceRole;
  pscheinExpiry?: string | null;
  pscheinConfirmedAt?: string | Date | null;
};

function hasTruthyConfirmation(
  user: DriverEligibilityUser | null | undefined,
): boolean {
  const ca = user?.pscheinConfirmedAt;
  if (ca == null || ca === "") return false;
  if (typeof ca === "string" && !ca.trim()) return false;
  return true;
}

/** Local calendar YYYY-MM-DD when no assignment date is provided (e.g. team picker). */
function fallbackAssignmentDateISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveAssignmentDateISO(
  assignmentDateISO: string | undefined,
): string {
  const d = assignmentDateISO?.trim();
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return fallbackAssignmentDateISO();
}

/**
 * Full backend Phase 3A driver rule: driver/both, confirmed P-Schein, non-empty expiry,
 * expiry valid on the assignment date (or today's date when none is passed).
 */
export function isDriverEligibleForAssignment(
  user: DriverEligibilityUser | null | undefined,
  assignmentDateISO: string | undefined,
): boolean {
  if (!isAmbulanceRoleDriverCapable(user?.ambulanceRole)) return false;
  if (!hasTruthyConfirmation(user)) return false;
  const exp =
    typeof user?.pscheinExpiry === "string" ? user.pscheinExpiry.trim() : "";
  if (!exp) return false;
  const dateForRule = resolveAssignmentDateISO(assignmentDateISO);
  return isPscheinExpiryValidOnAssignmentDate(exp, dateForRule);
}
