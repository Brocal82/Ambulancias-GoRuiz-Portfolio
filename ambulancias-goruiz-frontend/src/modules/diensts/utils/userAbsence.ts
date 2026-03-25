/**
 * Free-day absence for the logged-in user (worker views).
 *
 * Priority when ranges overlap: **sick** beats **vacation** (clearer medically / operational).
 * Uses only accepted vacation and accepted sick leaves; segments are tested independently
 * (no merged-span gaps from check-range APIs).
 */

export type UserAbsenceKind = "none" | "vacation" | "sick";

type SpanEntity = {
  status: string;
  startDate: string;
  endDate: string;
};

export function ymdFromApiDate(isoOrYmd: string): string {
  const m = String(isoOrYmd ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function isYmdInClosedRange(
  dayYmd: string,
  startYmd: string,
  endYmd: string,
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dayYmd) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startYmd) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)
  ) {
    return false;
  }
  return dayYmd >= startYmd && dayYmd <= endYmd;
}

export function resolveUserAbsenceForFreeDay(
  isoDay: string,
  vacations: ReadonlyArray<SpanEntity>,
  sickLeaves: ReadonlyArray<SpanEntity>,
): UserAbsenceKind {
  const dayYmd = ymdFromApiDate(isoDay);
  if (!dayYmd) return "none";

  for (const s of sickLeaves) {
    if (s.status !== "accepted") continue;
    const a = ymdFromApiDate(s.startDate);
    const b = ymdFromApiDate(s.endDate);
    if (a && b && isYmdInClosedRange(dayYmd, a, b)) return "sick";
  }

  for (const v of vacations) {
    if (v.status !== "accepted") continue;
    const a = ymdFromApiDate(v.startDate);
    const b = ymdFromApiDate(v.endDate);
    if (a && b && isYmdInClosedRange(dayYmd, a, b)) return "vacation";
  }

  return "none";
}
