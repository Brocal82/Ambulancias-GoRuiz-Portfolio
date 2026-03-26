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
 * Last calendar day (YYYY-MM-DD) of a Dienst week: `weekStartISO` + 6 days.
 * Same noon-anchor pattern as other week helpers to reduce TZ drift.
 */
export function lastDayOfDienstWeekISO(weekStartISO: string): string {
  const trimmed = weekStartISO.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(`${trimmed}T12:00:00`);
  if (isNaN(d.getTime())) return trimmed;
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Phase 3A rule for assigning a driver across an entire Dienst week: same as single-day
 * eligibility, but P-Schein must still be valid on the **last** day of that week (if valid
 * then, it is valid on every earlier day in the same ISO week span).
 */
export function isDriverEligibleForAssignmentWeek(
  user: DriverEligibilityUser | null | undefined,
  weekStartISO: string,
): boolean {
  if (!isAmbulanceRoleDriverCapable(user?.ambulanceRole)) return false;
  if (!hasTruthyConfirmation(user)) return false;
  const exp =
    typeof user?.pscheinExpiry === "string" ? user.pscheinExpiry.trim() : "";
  if (!exp) return false;
  const lastDay = lastDayOfDienstWeekISO(weekStartISO);
  return isPscheinExpiryValidOnAssignmentDate(exp, lastDay);
}

/**
 * Full backend Phase 3A driver rule: driver/both, confirmed P-Schein, non-empty expiry,
 * expiry valid on the assignment date (or browser "today" when `assignmentDateISO` is omitted —
 * used for flows without a slot date, e.g. team creation picker; not for weekly Dienst assign).
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
