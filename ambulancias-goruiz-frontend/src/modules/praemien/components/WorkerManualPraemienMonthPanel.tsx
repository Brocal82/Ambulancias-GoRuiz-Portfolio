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
import { labelPraemienManualStatus } from "../utils/labelPraemienManualStatus";
import { parseManualPraemieClientValue } from "../utils/parseManualPraemieClientValue";
import MonthlyMiniCalendar, { type ViewMonth } from "./MonthlyMiniCalendar";

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
    <div className="mx-auto max-w-4xl">
      {error && (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <p className="mb-3 text-sm text-slate-600">
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

      {selectedDate && (
        <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 ring-1 ring-slate-200/80">
          <p className="text-sm text-slate-700">
            {t("pages.praemien.manual.editDay", { date: selectedDate })}
          </p>
          {selectedEntry?.status === "approved" && selectedReadOnly ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-3">
              <p className="text-sm font-medium text-emerald-800">
                {selectedEntry.adminReviewedByName?.trim()
                  ? t("pages.praemien.manual.approvedByAdmin", {
                      name: selectedEntry.adminReviewedByName.trim(),
                    })
                  : t("pages.praemien.manual.approvedByAdminFallback")}
              </p>
              <p className="text-xs text-slate-500 tabular-nums sm:text-right">
                {t("pages.praemien.manual.lastSaved", {
                  at: new Date(
                    selectedEntry.workerSubmittedAt,
                  ).toLocaleString(i18n.language),
                })}
              </p>
            </div>
          ) : selectedReadOnly ? (
            <p className="text-sm text-amber-900">
              {t("pages.praemien.manual.readOnlyLegacyNoFinalClosure")}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-xs text-slate-600">
                {t("pages.praemien.manual.valueLabel")}
                <input
                  type="number"
                  min={0}
                  max={10_000}
                  step={0.1}
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  disabled={selectedReadOnly}
                  className="mt-0.5 w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                />
              </label>
              <button
                type="button"
                disabled={saving || selectedReadOnly}
                onClick={() => void handleSave()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("pages.praemien.manual.save")}
              </button>
            </div>
          )}
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
              <p>
                {t("pages.praemien.manual.originalLine", {
                  value: selectedEntry.originalWorkerValue,
                })}
              </p>
              {selectedEntry.status === "approved" &&
                selectedEntry.adminFinalValue != null && (
                  <p>
                    {t("pages.praemien.manual.finalLine", {
                      value: selectedEntry.adminFinalValue,
                    })}
                  </p>
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
