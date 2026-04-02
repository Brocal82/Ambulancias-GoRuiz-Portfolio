import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { MinimumRestWarning } from "../domain/api";
import { fmtDDMM, formatYYYYMMDDToDDMMYYYY } from "../../../utils/timeUtils";

/** Week end = start + 6 days (Berlin-safe noon anchor). */
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Only these four — no other pictograms in the issue list. */
const ICON = {
  sick: "🤒",
  vacation: "🏖️",
  minimumRest: "⏰",
  weeklyConflict: "⚠️",
} as const;

export type WeeklyAssignmentSummaryData =
  | {
      kind: "team";
      dienstNumber: number;
      weekStartDate: string;
      driverName: string;
      medicName: string;
      message: string;
      updatedCount: number;
      daysAssignedFull?: string[];
      daysAssignedDriverOnly?: string[];
      daysAssignedMedicOnly?: string[];
      skippedByMinimumRest?: string[];
      skippedByMinimumRestRoles?: Array<{ date: string; role: "driver" | "medic" }>;
      skippedByWeeklyConflict?: string[];
      skippedByVacation?: Array<{ date: string; role: "driver" | "medic" }>;
      skippedAbsences?: Array<{
        date: string;
        role: "driver" | "medic";
        reason: "vacation" | "sick";
      }>;
      minimumRestWarning?: MinimumRestWarning;
      hints?: { driverExpiredButBoth?: boolean };
    }
  | {
      kind: "user";
      dienstNumber: number;
      weekStartDate: string;
      workerName?: string;
      role: "driver" | "medic";
      message: string;
      updatedCount: number;
      skippedByMinimumRest?: string[];
      skippedByVacation?: string[];
      skippedBreakdown?: { sick: number; vacation: number; both: number };
      minimumRestWarning?: MinimumRestWarning;
    };

export type AssignmentIssueReason =
  | "absence"
  | "minimum_rest"
  | "weekly_conflict";

export type AssignmentIssueRow = {
  key: string;
  /** First day in the row (for sorting) */
  date: string;
  reason: AssignmentIssueReason;
  /** null = API does not distinguish vacation vs sick for this row */
  icon: string | null;
  label: string;
};

function asDateArray(v: string[] | undefined): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => String(s).trim()).filter(Boolean);
}

/**
 * User flow: per-date vacation vs sick is not in the API.
 * Only when breakdown indicates a single category for the whole assignment can we use 🏖️ / 🤒 truthfully.
 */
function userAbsenceIconMode(
  bd: { sick: number; vacation: number; both: number } | undefined,
): "vacation" | "sick" | "undifferentiated" {
  if (!bd) return "undifferentiated";
  const { sick, vacation, both } = bd;
  if (vacation > 0 && sick === 0 && both === 0) return "vacation";
  if (sick > 0 && vacation === 0 && both === 0) return "sick";
  return "undifferentiated";
}

/** Split sorted unique dates into consecutive runs (inclusive ISO days). */
function consecutiveRuns(sortedIso: string[]): string[][] {
  if (sortedIso.length === 0) return [];
  const runs: string[][] = [];
  let cur = [sortedIso[0]];
  for (let i = 1; i < sortedIso.length; i++) {
    const prev = sortedIso[i - 1];
    const d = sortedIso[i];
    if (addDaysISO(prev, 1) === d) cur.push(d);
    else {
      runs.push(cur);
      cur = [d];
    }
  }
  runs.push(cur);
  return runs;
}

function uniqueSorted(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b));
}

function rangeLabel(run: string[]): string {
  if (run.length === 0) return "";
  if (run.length === 1) return fmtDDMM(run[0]);
  return `${fmtDDMM(run[0])} al ${fmtDDMM(run[run.length - 1])}`;
}

function pushGroupedRows(params: {
  rows: AssignmentIssueRow[];
  dates: string[];
  icon: string | null;
  reason: AssignmentIssueReason;
  keyPrefix: string;
  labelForRun: (run: string[]) => string;
}): void {
  const { rows, dates, icon, reason, keyPrefix, labelForRun } = params;
  const runs = consecutiveRuns(uniqueSorted(dates));
  runs.forEach((run, ri) => {
    rows.push({
      key: `${keyPrefix}-${run[0]}-${run[run.length - 1]}-${ri}`,
      date: run[0],
      icon,
      reason,
      label: labelForRun(run),
    });
  });
}

function buildUnifiedIssues(
  data: WeeklyAssignmentSummaryData,
  t: TFunction,
): AssignmentIssueRow[] {
  const rows: AssignmentIssueRow[] = [];

  if (data.kind === "team") {
    const abs = data.skippedAbsences;
    if (abs && abs.length > 0) {
      const buckets = new Map<
        string,
        { role: "driver" | "medic"; reason: "vacation" | "sick"; dates: string[] }
      >();
      for (const row of abs) {
        const k = `${row.role}|${row.reason}`;
        let b = buckets.get(k);
        if (!b) {
          b = { role: row.role, reason: row.reason, dates: [] };
          buckets.set(k, b);
        }
        b.dates.push(row.date);
      }
      for (const b of buckets.values()) {
        const name =
          b.role === "driver" ? data.driverName : data.medicName;
        const icon = b.reason === "vacation" ? ICON.vacation : ICON.sick;
        pushGroupedRows({
          rows,
          dates: b.dates,
          icon,
          reason: "absence",
          keyPrefix: `abs-${b.role}-${b.reason}`,
          labelForRun: (run) =>
            b.reason === "vacation"
              ? t(
                  "pages.diensts.adminPage.weeklySummaryCompact.issueTeamVacationRange",
                  "{{name}} · {{range}} — vacaciones",
                  {
                    name,
                    range: rangeLabel(run),
                  },
                )
              : t(
                  "pages.diensts.adminPage.weeklySummaryCompact.issueTeamSickRange",
                  "{{name}} · {{range}} — baja",
                  {
                    name,
                    range: rangeLabel(run),
                  },
                ),
        });
      }
    } else {
      const vacByRole: Record<"driver" | "medic", string[]> = {
        driver: [],
        medic: [],
      };
      (data.skippedByVacation ?? []).forEach((row) => {
        vacByRole[row.role].push(row.date);
      });
      (["driver", "medic"] as const).forEach((role) => {
        const dlist = vacByRole[role];
        if (dlist.length === 0) return;
        const name = role === "driver" ? data.driverName : data.medicName;
        pushGroupedRows({
          rows,
          dates: dlist,
          icon: null,
          reason: "absence",
          keyPrefix: `vac-${role}`,
          labelForRun: (run) =>
            t(
              "pages.diensts.adminPage.weeklySummaryCompact.issueTeamAbsenceRange",
              "{{name}} · {{range}} — vacaciones o baja",
              {
                name,
                range: rangeLabel(run),
              },
            ),
        });
      });
    }

    const datesWithMinRestByRole = new Set(
      (data.skippedByMinimumRestRoles ?? []).map((r) => r.date),
    );

    pushGroupedRows({
      rows,
      dates: asDateArray(data.skippedByMinimumRest).filter(
        (d) => !datesWithMinRestByRole.has(d),
      ),
      icon: ICON.minimumRest,
      reason: "minimum_rest",
      keyPrefix: "mr-team",
      labelForRun: (run) =>
        t(
          "pages.diensts.adminPage.weeklySummaryCompact.issueMinRestTeamRange",
          "{{driver}} · {{medic}} · {{range}} — descanso mínimo",
          {
            driver: data.driverName,
            medic: data.medicName,
            range: rangeLabel(run),
          },
        ),
    });

    const mrByRole: Record<"driver" | "medic", string[]> = {
      driver: [],
      medic: [],
    };
    (data.skippedByMinimumRestRoles ?? []).forEach((r) => {
      mrByRole[r.role].push(r.date);
    });
    (["driver", "medic"] as const).forEach((role) => {
      const dates = mrByRole[role];
      if (dates.length === 0) return;
      const name = role === "driver" ? data.driverName : data.medicName;
      pushGroupedRows({
        rows,
        dates,
        icon: ICON.minimumRest,
        reason: "minimum_rest",
        keyPrefix: `mrr-${role}`,
        labelForRun: (run) =>
          t(
            "pages.diensts.adminPage.weeklySummaryCompact.issueMinRestTeamRoleRange",
            "{{name}} · {{range}} — descanso mínimo",
            { name, range: rangeLabel(run) },
          ),
      });
    });

    pushGroupedRows({
      rows,
      dates: asDateArray(data.skippedByWeeklyConflict),
      icon: ICON.weeklyConflict,
      reason: "weekly_conflict",
      keyPrefix: "wc",
      labelForRun: (run) =>
        t(
          "pages.diensts.adminPage.weeklySummaryCompact.issueWeeklyConflictRange",
          "{{range}} — conflicto",
          { range: rangeLabel(run) },
        ),
    });
  } else {
    const worker = data.workerName?.trim() || "—";
    const mode = userAbsenceIconMode(data.skippedBreakdown);
    const vacIcon =
      mode === "vacation"
        ? ICON.vacation
        : mode === "sick"
          ? ICON.sick
          : null;

    pushGroupedRows({
      rows,
      dates: asDateArray(data.skippedByVacation),
      icon: vacIcon,
      reason: "absence",
      keyPrefix: "vac-user",
      labelForRun: (run) => {
        const range = rangeLabel(run);
        if (mode === "vacation") {
          return t(
            "pages.diensts.adminPage.weeklySummaryCompact.issueUserVacationRange",
            "{{name}} · {{range}} — vacaciones",
            { name: worker, range },
          );
        }
        if (mode === "sick") {
          return t(
            "pages.diensts.adminPage.weeklySummaryCompact.issueUserSickRange",
            "{{name}} · {{range}} — baja médica",
            { name: worker, range },
          );
        }
        return t(
          "pages.diensts.adminPage.weeklySummaryCompact.issueUserAbsenceUndiffRange",
          "{{name}} · {{range}} — vacaciones o baja",
          { name: worker, range },
        );
      },
    });

    pushGroupedRows({
      rows,
      dates: asDateArray(data.skippedByMinimumRest),
      icon: ICON.minimumRest,
      reason: "minimum_rest",
      keyPrefix: "mr-user",
      labelForRun: (run) =>
        t(
          "pages.diensts.adminPage.weeklySummaryCompact.issueMinRestUserRange",
          "{{name}} · {{range}} — descanso mínimo",
          { name: worker, range: rangeLabel(run) },
        ),
    });
  }

  rows.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    const order: Record<AssignmentIssueReason, number> = {
      absence: 0,
      minimum_rest: 1,
      weekly_conflict: 2,
    };
    return order[a.reason] - order[b.reason];
  });

  return rows;
}

interface Props {
  data: WeeklyAssignmentSummaryData;
  onClose: () => void;
}

export default function WeeklyAssignmentSummaryModal({ data, onClose }: Props) {
  const { t } = useTranslation();

  const weekEndISO = addDaysISO(data.weekStartDate, 6);
  const weekRangeLabel = `${formatYYYYMMDDToDDMMYYYY(data.weekStartDate)} al ${formatYYYYMMDDToDDMMYYYY(weekEndISO)}`;
  const issues = buildUnifiedIssues(data, t);

  const hasIssues = issues.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[min(72vh,520px)] w-full max-w-sm flex-col rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-assignment-summary-title"
      >
        <div className="rounded-t-xl border-b border-slate-200/80 bg-slate-50/90 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <h3
              id="weekly-assignment-summary-title"
              className="text-base font-semibold tracking-tight text-slate-900"
            >
              {t(
                "pages.diensts.adminPage.weeklySummaryCompact.headerDienstLabel",
                "Dienst #{{num}}",
                { num: data.dienstNumber },
              )}
            </h3>
            <p className="shrink-0 text-right text-xs text-slate-600">{weekRangeLabel}</p>
          </div>
          {data.kind === "team" ? (
            <p className="mt-3 text-sm text-slate-800">
              <span className="text-slate-500">
                {t(
                  "pages.diensts.adminPage.weeklySummaryCompact.teamLabel",
                  "Team:",
                )}{" "}
              </span>
              <span className="font-medium">{data.driverName}</span>
              <span className="text-slate-400"> · </span>
              <span className="font-medium">{data.medicName}</span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-800">
              <span className="text-slate-500">
                {t(
                  "pages.diensts.adminPage.weeklySummaryCompact.userLabel",
                  "Usuario:",
                )}{" "}
              </span>
              <span className="font-medium">{data.workerName ?? "—"}</span>
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {hasIssues && (
            <>
              <p className="mb-2 text-sm font-medium text-red-600">
                {t(
                  "pages.diensts.adminPage.weeklySummaryCompact.incidentCount",
                  "{{count}} incidencias",
                  { count: issues.length },
                )}
              </p>
              <ul className="space-y-1.5">
                {issues.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5 text-xs text-slate-800"
                  >
                    <span
                      className="inline-flex w-5 shrink-0 justify-center pt-px leading-none"
                      aria-hidden
                    >
                      {row.icon ?? "\u00A0"}
                    </span>
                    <span className="min-w-0 leading-snug">{row.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!hasIssues &&
            !data.minimumRestWarning &&
            !(data.kind === "team" && data.hints?.driverExpiredButBoth) && (
              <p className="text-xs text-slate-500">
                {t(
                  "pages.diensts.adminPage.weeklySummaryCompact.noSkips",
                  "Sin incidencias en este resumen.",
                )}
              </p>
            )}

          {data.minimumRestWarning && (
            <p
              className={`text-xs leading-snug text-amber-800 ${hasIssues ? "mt-3" : ""}`}
            >
              <span aria-hidden>{ICON.minimumRest} </span>
              {data.minimumRestWarning.message}
            </p>
          )}

          {data.kind === "team" && data.hints?.driverExpiredButBoth && (
            <p
              className={`text-xs leading-snug text-slate-600 ${hasIssues || data.minimumRestWarning ? "mt-2" : ""}`}
            >
              {t("pages.diensts.adminPage.considerSwap")}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            onClick={onClose}
          >
            {t("pages.diensts.adminPage.weeklySummary.gotIt", "Entendido")}
          </button>
        </div>
      </div>
    </div>
  );
}
