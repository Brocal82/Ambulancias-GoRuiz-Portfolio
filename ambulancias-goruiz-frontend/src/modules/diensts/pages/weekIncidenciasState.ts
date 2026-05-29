import type { WeeklyAssignmentSummaryData } from "../components/WeeklyAssignmentSummaryModal";

/** Drop saved summaries for one Dienst after clear-week-people succeeds. */
export function pruneSavedWeekIncidencias(
  prev: Record<string, WeeklyAssignmentSummaryData[]>,
  weekStartISO: string,
  dienstNumber: number,
): Record<string, WeeklyAssignmentSummaryData[]> {
  const week = prev[weekStartISO];
  if (!week?.length) return prev;
  const nextWeek = week.filter((s) => s.dienstNumber !== dienstNumber);
  if (nextWeek.length === week.length) return prev;
  const next = { ...prev };
  if (nextWeek.length === 0) delete next[weekStartISO];
  else next[weekStartISO] = nextWeek;
  return next;
}

/** Drop acknowledged issue keys for one Dienst (scoped keys: `{dienstNumber}:…`). */
export function pruneAcknowledgedWeekIssueKeys(
  prev: Record<string, string[]>,
  weekStartISO: string,
  dienstNumber: number,
): Record<string, string[]> {
  const week = prev[weekStartISO];
  if (!week?.length) return prev;
  const prefix = `${dienstNumber}:`;
  const nextWeek = week.filter((k) => !k.startsWith(prefix));
  if (nextWeek.length === week.length) return prev;
  const next = { ...prev };
  if (nextWeek.length === 0) delete next[weekStartISO];
  else next[weekStartISO] = nextWeek;
  return next;
}

/** Close stale modal queue entries for the cleared Dienst/week. */
export function pruneWeeklySummaryQueue(
  prev: WeeklyAssignmentSummaryData[],
  weekStartISO: string,
  dienstNumber: number,
): WeeklyAssignmentSummaryData[] {
  return prev.filter(
    (s) =>
      !(
        s.weekStartDate === weekStartISO && s.dienstNumber === dienstNumber
      ),
  );
}
