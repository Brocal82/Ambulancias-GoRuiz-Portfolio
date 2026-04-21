import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PraemienModeEffectiveFrom } from "../../companies/domain/types";
import {
  getMyManualDailyEntriesForMonth,
  putMyManualDailyEntry,
  type ManualDailyEntryDto,
} from "../domain/manualDailyApi";
import { labelPraemienManualStatus } from "../utils/labelPraemienManualStatus";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month1: number, day: number): string {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;
  return dt;
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
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<ManualDailyEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);

  const effStart = useMemo(() => effectiveStartDate(effectiveFrom), [effectiveFrom]);
  const tStart = useMemo(() => todayStart(), []);

  const monthStart = useMemo(
    () => new Date(year, month - 1, 1),
    [year, month],
  );
  const daysInMonth = useMemo(
    () => new Date(year, month, 0).getDate(),
    [year, month],
  );

  const minYm = useMemo(() => {
    return { y: effStart.getFullYear(), m: effStart.getMonth() + 1 };
  }, [effStart]);

  const maxYm = useMemo(() => {
    return { y: tStart.getFullYear(), m: tStart.getMonth() + 1 };
  }, [tStart]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMyManualDailyEntriesForMonth(year, month);
      setEntries(data);
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

  const selectedEntry = selectedDate ? byDate.get(selectedDate) : undefined;
  const selectedReadOnly = selectedEntry?.status === "approved";

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

  const dayMeta = useCallback(
    (day: number) => {
      const dateStr = ymd(year, month, day);
      const d = parseYmd(dateStr);
      if (!d) return { dateStr, disabled: true };
      const disabled = d < effStart || d > tStart;
      return { dateStr, disabled };
    },
    [year, month, effStart, tStart],
  );

  const monthLabel = monthStart.toLocaleString(i18n.language, {
    month: "long",
    year: "numeric",
  });

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
    if (!selectedDate || saving || selectedReadOnly) return;
    const n = Number(draftValue);
    if (!Number.isInteger(n) || n < 0 || n > 10_000) {
      setError(t("pages.praemien.manual.invalidValue"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await putMyManualDailyEntry({
        date: selectedDate,
        workerSubmittedValue: n,
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
    <div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-900">
        {t("pages.praemien.manual.title")}
      </h2>

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={goPrevMonth}
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 disabled:opacity-40"
        >
          {t("pages.praemien.manual.prevMonth")}
        </button>
        <span className="text-sm font-medium capitalize text-slate-800">
          {monthLabel}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={goNextMonth}
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 disabled:opacity-40"
        >
          {t("pages.praemien.manual.nextMonth")}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-600">
          {t("pages.praemien.manual.loading")}
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] sm:text-xs">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="py-1 font-semibold text-slate-500">
              {t(`pages.praemien.manual.weekdayShort.${i}`)}
            </div>
          ))}
          {Array.from(
            { length: (monthStart.getDay() + 6) % 7 },
            (_, i) => (
              <div key={`pad-${i}`} />
            ),
          )}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const { dateStr, disabled } = dayMeta(day);
            const val = byDate.get(dateStr);
            const isSel = selectedDate === dateStr;
            const cellNum =
              val != null && val.status === "approved" && val.adminFinalValue != null
                ? val.adminFinalValue
                : val?.workerSubmittedValue;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedDate(dateStr)}
                className={[
                  "flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border px-0.5 py-1 transition-colors",
                  disabled
                    ? "cursor-not-allowed border-transparent bg-slate-50 text-slate-300"
                    : isSel
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
                ].join(" ")}
              >
                <span className="font-semibold">{day}</span>
                {!disabled && val != null && (
                  <span
                    className={[
                      "tabular-nums text-[10px]",
                      val.status === "approved"
                        ? "font-semibold text-emerald-700"
                        : val.status === "rejected"
                          ? "text-rose-600"
                          : "text-slate-600",
                    ].join(" ")}
                  >
                    {cellNum}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedDate && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-700">
            {t("pages.praemien.manual.editDay", { date: selectedDate })}
          </p>
          {selectedReadOnly ? (
            <p className="text-sm text-emerald-800">
              {t("pages.praemien.manual.approvedReadOnly")}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-xs text-slate-600">
                {t("pages.praemien.manual.valueLabel")}
                <input
                  type="number"
                  min={0}
                  max={10_000}
                  step={1}
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
              <p>
                {t("pages.praemien.manual.statusLine", {
                  status: labelPraemienManualStatus(t, selectedEntry.status),
                })}
              </p>
              {selectedEntry.status === "rejected" && selectedEntry.rejectionReason && (
                <p className="text-rose-700">
                  {t("pages.praemien.manual.rejectedReason", {
                    reason: selectedEntry.rejectionReason,
                  })}
                </p>
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
              <p>
                {t("pages.praemien.manual.lastSaved", {
                  at: new Date(selectedEntry.workerSubmittedAt).toLocaleString(
                    i18n.language,
                  ),
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkerManualPraemienMonthPanel;
