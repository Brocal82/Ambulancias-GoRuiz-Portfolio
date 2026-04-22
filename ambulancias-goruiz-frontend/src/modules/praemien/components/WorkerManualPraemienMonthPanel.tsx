import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../hooks/useAuth";
import type { PraemienModeEffectiveFrom } from "../../companies/domain/types";
import {
  getMyFinalClosureDatesForMonth,
  getMyManualDailyEntriesForMonth,
  putMyManualDailyEntry,
  type ManualDailyEntryDto,
} from "../domain/manualDailyApi";
import type { MonthlyPraemienDay } from "../domain/api";
import { usePraemienDienstDayTints } from "../hooks/usePraemienDienstDayTints";
import { maxNavigablePraemienYm } from "../utils/dienstCalendarTints";
import { dispatchPraemienManualPendingChanged } from "../utils/praemienManualPendingEvents";
import { labelPraemienManualStatus } from "../utils/labelPraemienManualStatus";
import { parseManualPraemieClientValue } from "../utils/parseManualPraemieClientValue";
import { fmtDDMM } from "../../../utils/timeUtils";
import MonthlyMiniCalendar, { type ViewMonth } from "./MonthlyMiniCalendar";
import {
  PRAEMIE_QUEUE_TABLE_SHELL_CLASS,
  PRAEMIE_WORKER_DETAIL_bodyRow,
  PRAEMIE_WORKER_DETAIL_headerRow,
} from "./praemieManualQueueTableStyles";
import type { AssignedDay, UserRef } from "../../diensts/domain/types";

/** Alineado con el DTO; tolera `rejection_reason` si en alguna respuesta llega en snake_case. */
function getManualRejectionNote(e: ManualDailyEntryDto): string {
  const raw =
    e.rejectionReason?.trim() ??
    (e as { rejection_reason?: string | null }).rejection_reason?.trim() ??
    "";
  return raw;
}

function getManualReopenNote(e: ManualDailyEntryDto): string {
  const raw =
    e.reopenNote?.trim() ??
    (e as { reopen_note?: string | null }).reopen_note?.trim() ??
    "";
  return raw;
}

function effectiveStartDate(from: PraemienModeEffectiveFrom): Date {
  const d = new Date(from.year, from.month - 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function personListLabel(ref: string | UserRef | undefined): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref.trim();
  const ln = String(ref.lastName ?? "").trim();
  const fn = String(ref.name ?? "").trim();
  if (ln && fn) return `${ln}, ${fn}`;
  return ln || fn;
}

/** Misma convención que la cola admin: apellido, nombre; conductor / sanitario. */
function formatEquipoFromAssignedDay(a: AssignedDay | undefined): string {
  if (!a) return "";
  const d = personListLabel(a.driver);
  const m = personListLabel(a.medic);
  if (d && m) return `${d} / ${m}`;
  return d || m;
}

function ManualEntryStatusCheckIcon({
  colorClassName,
  title,
  ariaLabel,
}: {
  colorClassName: string;
  title: string;
  ariaLabel: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 ${colorClassName}`}
      title={title}
      aria-label={ariaLabel}
      role="img"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-7 w-7"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fillRule="evenodd"
          d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

interface Props {
  effectiveFrom: PraemienModeEffectiveFrom;
}

const WorkerManualPraemienMonthPanel = ({ effectiveFrom }: Props) => {
  const { t, i18n } = useTranslation();
  const { userId } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<ManualDailyEntryDto[]>([]);
  const [closureEligible, setClosureEligible] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);

  const effStart = useMemo(() => effectiveStartDate(effectiveFrom), [effectiveFrom]);
  const tStart = useMemo(() => todayStart(), []);

  const minYm = useMemo(() => {
    return { y: effStart.getFullYear(), m: effStart.getMonth() + 1 };
  }, [effStart]);

  const { dayBaseClassName, dienstByDate } = usePraemienDienstDayTints(userId);

  const maxYm = useMemo(
    () => maxNavigablePraemienYm(tStart, dienstByDate.keys(), 12),
    [tStart, dienstByDate],
  );

  const viewMonth: ViewMonth = useMemo(() => ({ year, month }), [year, month]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, closureDates] = await Promise.all([
        getMyManualDailyEntriesForMonth(year, month),
        getMyFinalClosureDatesForMonth(year, month),
      ]);
      setEntries(data);
      setClosureEligible(new Set(closureDates));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.manual.loadError");
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [year, month, t]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const byDate = useMemo(() => {
    const m = new Map<string, ManualDailyEntryDto>();
    entries.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries]);

  const summaryDays: MonthlyPraemienDay[] = useMemo(() => {
    return entries.map((e) => {
      const v =
        e.status === "approved" && e.adminFinalValue != null
          ? e.adminFinalValue
          : e.workerSubmittedValue;
      return { date: e.date, totalCountedPatients: v };
    });
  }, [entries]);

  const selectedEntry = selectedDate ? byDate.get(selectedDate) : undefined;
  const selectedAssignment = useMemo(
    () => (selectedDate ? dienstByDate.get(selectedDate) : undefined),
    [selectedDate, dienstByDate],
  );

  const selectedReadOnly = useMemo(() => {
    if (selectedEntry?.status === "approved") return true;
    if (
      selectedDate &&
      !closureEligible.has(selectedDate) &&
      selectedEntry != null
    ) {
      return true;
    }
    return false;
  }, [selectedEntry, selectedDate, closureEligible]);

  const canEditTrips = Boolean(
    selectedDate &&
      closureEligible.has(selectedDate) &&
      !selectedReadOnly,
  );

  useEffect(() => {
    if (!selectedDate) {
      setDraftValue("");
      return;
    }
    const ex = byDate.get(selectedDate);
    if (ex == null) {
      setDraftValue("");
      return;
    }
    if (ex.status === "approved") {
      setDraftValue(
        String(ex.adminFinalValue ?? ex.workerSubmittedValue),
      );
    } else {
      setDraftValue(String(ex.workerSubmittedValue));
    }
  }, [selectedDate, byDate]);

  const parseYmd = useCallback((s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [a, b, c] = s.split("-").map(Number);
    const dt = new Date(a, b - 1, c);
    dt.setHours(0, 0, 0, 0);
    if (dt.getFullYear() !== a || dt.getMonth() !== b - 1 || dt.getDate() !== c)
      return null;
    return dt;
  }, []);

  const isDisabled = useCallback(
    (dateKey: string) => {
      const d = parseYmd(dateKey);
      if (!d) return true;
      if (d < effStart || d > tStart) return true;
      if (closureEligible.has(dateKey)) return false;
      return !byDate.has(dateKey);
    },
    [parseYmd, effStart, tStart, closureEligible, byDate],
  );

  const valueClassName = useCallback(
    (dateKey: string) => {
      const e = byDate.get(dateKey);
      if (!e) return "text-slate-900";
      if (e.status === "approved") return "text-emerald-700";
      if (e.status === "rejected") return "text-rose-600";
      return "text-slate-600";
    },
    [byDate],
  );

  const goPrevMonth = () => {
    if (year === minYm.y && month === minYm.m) return;
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const goNextMonth = () => {
    if (year === maxYm.y && month === maxYm.m) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const canPrev = year > minYm.y || (year === minYm.y && month > minYm.m);
  const canNext = year < maxYm.y || (year === maxYm.y && month < maxYm.m);

  const handleSave = async () => {
    if (
      !selectedDate ||
      saving ||
      selectedReadOnly ||
      !closureEligible.has(selectedDate)
    ) {
      return;
    }
    const parsed = parseManualPraemieClientValue(draftValue);
    if (!parsed.ok) {
      setError(t("pages.praemien.manual.invalidValue"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await putMyManualDailyEntry({
        date: selectedDate,
        workerSubmittedValue: parsed.value,
        status: "submitted",
      });
      await loadMonth();
      dispatchPraemienManualPendingChanged();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.manual.saveError");
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      {error && (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="mx-auto w-full max-w-4xl space-y-3">
        <p className="text-sm text-slate-600">
          {t("pages.praemien.manual.finalClosureOnlyHint")}
        </p>

        {loading ? (
          <p className="text-center text-sm text-slate-600">
            {t("pages.praemien.manual.loading")}
          </p>
        ) : (
          <MonthlyMiniCalendar
            viewMonth={viewMonth}
            days={summaryDays}
            titleKey="pages.praemien.page.dailyHistoryTitle"
            monthNav={{
              onPrev: goPrevMonth,
              onNext: goNextMonth,
              canPrev,
              canNext,
              prevLabel: t("pages.praemien.manual.prevMonth"),
              nextLabel: t("pages.praemien.manual.nextMonth"),
            }}
            interactive={{
              selectedKey: selectedDate,
              onSelect: (key) =>
                setSelectedDate((prev) => (prev === key ? null : key)),
              isDisabled,
              valueClassName,
              dayBaseClassName,
            }}
          />
        )}
      </div>

      {selectedDate && (
        <div className="min-w-0 w-full space-y-3 text-xs">
          <div
            className={PRAEMIE_QUEUE_TABLE_SHELL_CLASS}
            role="table"
            aria-label={t("pages.praemien.manual.detailHeading")}
          >
            <div role="rowgroup">
              <div role="row" className={PRAEMIE_WORKER_DETAIL_headerRow}>
                <div
                  role="columnheader"
                  className="min-w-0 break-words text-center"
                >
                  {t("pages.adminUsers.praemieListColEquipo")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 whitespace-nowrap text-center"
                >
                  {t("pages.adminUsers.praemieListColDate")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 break-words text-center"
                >
                  {t("pages.adminUsers.praemieListColDienst")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 break-words text-center"
                >
                  {t("pages.adminUsers.praemieListColManualValue")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 break-words text-center"
                >
                  {t("pages.adminUsers.praemieListColFinalValue")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 break-words text-center"
                >
                  {t("pages.praemien.manual.detailApprovedBy")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 break-words text-center"
                >
                  {t("pages.praemien.manual.detailApprovedAt")}
                </div>
                <div
                  role="columnheader"
                  className="min-w-0 w-full break-words text-center"
                >
                  {t("pages.adminUsers.praemieListColActions")}
                </div>
              </div>
            </div>
            <div role="rowgroup">
              <div role="row" className={PRAEMIE_WORKER_DETAIL_bodyRow}>
                <div role="cell" className="min-w-0 text-center text-slate-900">
                  <div className="line-clamp-2 break-words font-medium leading-tight">
                    {formatEquipoFromAssignedDay(selectedAssignment) || "—"}
                  </div>
                </div>
                <div
                  role="cell"
                  className="min-w-0 whitespace-nowrap text-center tabular-nums text-slate-800"
                >
                  {fmtDDMM(selectedDate) || "—"}
                </div>
                <div
                  role="cell"
                  className="min-w-0 text-center tabular-nums text-slate-800"
                >
                  {selectedAssignment?.dienstNumber != null
                    ? selectedAssignment.dienstNumber
                    : "—"}
                </div>
                <div
                  role="cell"
                  className="min-w-0 text-center tabular-nums text-slate-800"
                >
                  {selectedEntry != null
                    ? selectedEntry.workerSubmittedValue
                    : "—"}
                </div>
                <div
                  role="cell"
                  className="min-w-0 text-center tabular-nums text-slate-800"
                >
                  {selectedEntry?.status === "approved" ? (
                    <span className="tabular-nums text-slate-800">
                      {selectedEntry.adminFinalValue ??
                        selectedEntry.workerSubmittedValue}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
                <div
                  role="cell"
                  className="min-w-0 text-center text-slate-800"
                >
                  {selectedEntry?.status === "approved" ? (
                    <span className="line-clamp-2 break-words font-medium leading-tight">
                      {selectedEntry.adminReviewedByName?.trim() ||
                        t("pages.praemien.manual.approvedByAdminFallback")}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
                <div
                  role="cell"
                  className="min-w-0 whitespace-nowrap text-center tabular-nums text-slate-800"
                >
                  {selectedEntry?.status === "approved" &&
                  selectedEntry.adminReviewedAt ? (
                    new Date(selectedEntry.adminReviewedAt).toLocaleString(
                      i18n.language,
                      { dateStyle: "short", timeStyle: "short" },
                    )
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
                <div
                  role="cell"
                  className="min-w-0 w-full justify-self-stretch"
                >
                  <div className="flex min-h-[2rem] w-full min-w-0 flex-wrap items-center justify-center gap-1.5 px-0.5">
                    {selectedEntry?.status === "approved" &&
                    selectedReadOnly ? (
                      <ManualEntryStatusCheckIcon
                        colorClassName="text-emerald-600"
                        title={t("pages.praemien.manual.approvedDayAria")}
                        ariaLabel={t("pages.praemien.manual.approvedDayAria")}
                      />
                    ) : selectedEntry?.status === "submitted" ? (
                      <ManualEntryStatusCheckIcon
                        colorClassName="text-amber-500"
                        title={t(
                          "pages.praemien.manual.pendingReviewDayAria",
                        )}
                        ariaLabel={t(
                          "pages.praemien.manual.pendingReviewDayAria",
                        )}
                      />
                    ) : canEditTrips ? (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={10_000}
                          step={0.1}
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          disabled={saving}
                          title={t("pages.praemien.manual.valueLabel")}
                          aria-label={t("pages.praemien.manual.valueLabel")}
                          className="box-border h-7 w-[4.25rem] max-w-full shrink-0 rounded border border-slate-300 bg-white px-1 text-center text-xs tabular-nums text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleSave()}
                          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving
                            ? t("common.saving")
                            : t("pages.praemien.manual.save")}
                        </button>
                      </>
                    ) : selectedReadOnly ? (
                      <p className="max-w-[14rem] text-center text-[10px] font-medium leading-snug text-amber-900">
                        {t(
                          "pages.praemien.manual.readOnlyLegacyNoFinalClosure",
                        )}
                      </p>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {selectedEntry && (
            <div className="space-y-1 text-xs text-slate-500">
              {selectedEntry.status !== "approved" && (
                <p>
                  {t("pages.praemien.manual.statusLine", {
                    status: labelPraemienManualStatus(t, selectedEntry.status),
                  })}
                </p>
              )}
              {selectedEntry.status === "rejected" && (
                <p className="whitespace-pre-wrap text-rose-800">
                  {getManualRejectionNote(selectedEntry)
                    ? t("pages.praemien.manual.rejectedReason", {
                        reason: getManualRejectionNote(selectedEntry),
                      })
                    : t("pages.praemien.manual.rejectedNoComment")}
                </p>
              )}
              {selectedEntry.status === "reopened" && (
                <div className="space-y-1 text-amber-900">
                  <p>{t("pages.praemien.manual.reopenedHint")}</p>
                  {getManualReopenNote(selectedEntry) && (
                    <p className="whitespace-pre-wrap rounded-md bg-amber-50/90 px-2 py-1.5 text-amber-950 ring-1 ring-amber-200/80">
                      {t("pages.praemien.manual.reopenNoteFromAdmin", {
                        note: getManualReopenNote(selectedEntry),
                      })}
                    </p>
                  )}
                </div>
              )}
              {selectedEntry.status !== "approved" && (
                <p>
                  {t("pages.praemien.manual.lastSaved", {
                    at: new Date(selectedEntry.workerSubmittedAt).toLocaleString(
                      i18n.language,
                    ),
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkerManualPraemienMonthPanel;
