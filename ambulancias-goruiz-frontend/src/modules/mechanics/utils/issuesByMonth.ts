// src/utils/mechanics/issuesByMonth.ts
import type { WorkdayIssue } from "../domain/types";

export type IssueMonthCounts = {
  total: number;
  unseen: number;
};

export type IssueCountsByMonth = Record<number, IssueMonthCounts>; // 0..11

const isSameYearMonth = (iso: string, year: number, monthIndex: number) => {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === monthIndex;
};

export function buildIssueCountsByMonthForYear(
  issues: WorkdayIssue[],
  year: number,
): IssueCountsByMonth {
  const out: IssueCountsByMonth = {};

  for (const issue of issues) {
    const d = new Date(issue.timestamp);
    const y = d.getFullYear();
    if (y !== year) continue;

    const m = d.getMonth();
    const cur = out[m] ?? { total: 0, unseen: 0 };
    cur.total += 1;
    if (issue.isSeen !== true) cur.unseen += 1;
    out[m] = cur;
  }

  return out;
}

export function filterIssuesByYearMonth(
  issues: WorkdayIssue[],
  year: number,
  monthIndex: number,
): WorkdayIssue[] {
  return issues.filter((it) => isSameYearMonth(it.timestamp, year, monthIndex));
}
