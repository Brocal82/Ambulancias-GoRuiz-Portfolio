import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PraemienModeEffectiveFrom } from "../../companies/domain/types";
import type { MonthlyPraemienDay } from "../domain/api";
import {
  getAdminManualDailyMonth,
  postAdminManualDailyApprove,
  postAdminManualDailyCorrectApprove,
  postAdminManualDailyReject,
  postAdminManualDailyReopen,
  type ManualDailyEntryDto,
} from "../domain/manualDailyApi";
import { usePraemienDienstDayTints } from "../hooks/usePraemienDienstDayTints";
import { maxNavigablePraemienYm } from "../utils/dienstCalendarTints";
import { labelPraemienManualStatus } from "../utils/labelPraemienManualStatus";
import { parseManualPraemieClientValue } from "../utils/parseManualPraemieClientValue";
import MonthlyMiniCalendar, { type ViewMonth } from "./MonthlyMiniCalendar";

interface Props {
  userId: string;
  /** Límites de mes (mismo criterio que el trabajador). Si es null, solo se limita a no ir a meses futuros. */
  effectiveFrom: PraemienModeEffectiveFrom | null;
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

const AdminManualPraemienReviewPanel = ({
  userId,
  effectiveFrom,
}: Props) => {
  const { t } = useTranslation();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<ManualDailyEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ManualDailyEntryDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [correctVal, setCorrectVal] = useState("");
  const [reopenNote, setReopenNote] = useState("");
  const [busy, setBusy] = useState(false);

  const tStart = useMemo(() => todayStart(), []);
  const effStart = useMemo(
    () => (effectiveFrom ? effectiveStartDate(effectiveFrom) : null),
    [effectiveFrom],
  );

  const minYm = useMemo(() => {
    if (effStart) {
      return { y: effStart.getFullYear(), m: effStart.getMonth() + 1 };
    }
    return { y: 2020, m: 1 };
  }, [effStart]);

  const { dayBaseClassName, dienstByDate } = usePraemienDienstDayTints(userId);

  const maxYm = useMemo(
    () => maxNavigablePraemienYm(tStart, dienstByDate.keys(), 12),
    [tStart, dienstByDate],
  );

  const viewMonth: ViewMonth = useMemo(() => ({ year, month }), [year, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminManualDailyMonth(userId, year, month);
      setRows(data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.adminManual.loadError");
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [userId, year, month, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const m = new Map<string, ManualDailyEntryDto>();
    rows.forEach((r) => m.set(r.date, r));
    return m;
  }, [rows]);

  const summaryDays: MonthlyPraemienDay[] = useMemo(() => {
    return rows.map((r) => {
      const v =
        r.status === "approved" && r.adminFinalValue != null
          ? r.adminFinalValue
          : r.workerSubmittedValue;
      return { date: r.date, totalCountedPatients: v };
    });
  }, [rows]);

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
      if (effStart && d < effStart) return true;
      if (d > tStart) return true;
      return !byDate.has(dateKey);
    },
    [parseYmd, effStart, tStart, byDate],
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

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      setSelected(null);
      setRejectReason("");
      setCorrectVal("");
      setReopenNote("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.adminManual.actionError");
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  const goPrevMonth = () => {
    if (year === minYm.y && month === minYm.m) return;
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
    setSelected(null);
  };

  const goNextMonth = () => {
    if (year === maxYm.y && month === maxYm.m) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelected(null);
  };

  const canPrev = year > minYm.y || (year === minYm.y && month > minYm.m);
  const canNext = year < maxYm.y || (year === maxYm.y && month < maxYm.m);

  return (
    <div className="mx-auto mt-2 max-w-4xl space-y-4">
      <p className="text-sm text-slate-600">{t("pages.praemien.adminManual.instructions")}</p>

      {error && !selected && (
        <p className="rounded bg-rose-50 px-2 py-1.5 text-sm text-rose-800">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">{t("pages.praemien.adminManual.loading")}</p>
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
            selectedKey: selected?.date ?? null,
            onSelect: (key) => {
              const row = byDate.get(key);
              if (!row) return;
              setSelected((prev) =>
                prev?.date === key ? null : row,
              );
            },
            isDisabled,
            valueClassName,
            dayBaseClassName,
          }}
        />
      )}

      {selected && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          {error && (
            <p className="rounded bg-rose-50 px-2 py-1.5 text-sm text-rose-800">{error}</p>
          )}
          <p className="text-sm font-medium text-slate-800">
            {t("pages.praemien.adminManual.selected", { date: selected.date })}
          </p>
          <p className="text-xs text-slate-600">
            {t("pages.praemien.adminManual.statusPreview", {
              status: labelPraemienManualStatus(t, selected.status),
            })}
          </p>
          {selected.rejectionReason && (
            <p className="text-xs text-rose-700">
              {t("pages.praemien.adminManual.rejectReason", {
                reason: selected.rejectionReason,
              })}
            </p>
          )}
          {selected.status === "draft" && (
            <p className="text-xs text-slate-600">
              {t("pages.praemien.adminManual.draftHint")}
            </p>
          )}
          {(selected.status === "submitted" || selected.status === "reopened") && (
            <label className="block text-[11px] text-slate-600">
              {t("pages.praemien.adminManual.rejectReasonLabel")}
              <input
                className="mt-0.5 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {(selected.status === "submitted" || selected.status === "reopened") && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await postAdminManualDailyApprove({
                        userId,
                        date: selected.date,
                      });
                    })
                  }
                >
                  {t("pages.praemien.adminManual.approve")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await postAdminManualDailyReject({
                        userId,
                        date: selected.date,
                        reason: rejectReason,
                      });
                    })
                  }
                >
                  {t("pages.praemien.adminManual.reject")}
                </button>
                <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
                  <label className="flex flex-col text-[11px] text-slate-600">
                    {t("pages.praemien.adminManual.correctValue")}
                    <input
                      type="number"
                      min={0}
                      max={10_000}
                      step={0.1}
                      className="w-24 rounded border border-slate-300 bg-white px-1 py-0.5"
                      value={correctVal}
                      onChange={(e) => setCorrectVal(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    onClick={() => {
                      const parsed = parseManualPraemieClientValue(correctVal);
                      if (!parsed.ok) {
                        setError(t("pages.praemien.adminManual.invalidCorrect"));
                        return;
                      }
                      void run(async () => {
                        await postAdminManualDailyCorrectApprove({
                          userId,
                          date: selected.date,
                          adminFinalValue: parsed.value,
                        });
                      });
                    }}
                  >
                    {t("pages.praemien.adminManual.correctApprove")}
                  </button>
                </div>
              </>
            )}
            {selected.status === "approved" && (
              <div className="flex w-full flex-wrap items-end gap-2">
                <label className="flex flex-col text-[11px] text-slate-600">
                  {t("pages.praemien.adminManual.reopenNote")}
                  <input
                    className="w-48 max-w-full rounded border border-slate-300 bg-white px-1 py-0.5"
                    value={reopenNote}
                    onChange={(e) => setReopenNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await postAdminManualDailyReopen({
                        userId,
                        date: selected.date,
                        note: reopenNote,
                      });
                    })
                  }
                >
                  {t("pages.praemien.adminManual.reopen")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-500">{t("pages.praemien.adminManual.empty")}</p>
      )}
    </div>
  );
};

export default AdminManualPraemienReviewPanel;
