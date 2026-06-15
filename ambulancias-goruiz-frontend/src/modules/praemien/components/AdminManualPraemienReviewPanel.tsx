import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PraemienModeEffectiveFrom } from "../../companies/domain/types";
import type { MonthlyPraemienDay } from "../domain/api";
import {
  getAdminManualDailyMonth,
  getAdminManualPraemieDayQueueRow,
  postAdminManualDailyApprove,
  postAdminManualDailyReopen,
  type AdminManualPraemieQueueRowData,
  type ManualDailyEntryDto,
} from "../domain/manualDailyApi";
import { usePraemienDienstDayTints } from "../hooks/usePraemienDienstDayTints";
import { maxNavigablePraemienYm } from "../utils/dienstCalendarTints";
import {
  PRAEMIEN_MANUAL_PENDING_CHANGED,
  dispatchPraemienManualPendingChanged,
} from "../utils/praemienManualPendingEvents";
import { parseManualPraemieClientValue } from "../utils/parseManualPraemieClientValue";
import { showManualApproveSuccessToast } from "../utils/showManualApproveSuccessToast";
import MonthlyMiniCalendar, { type ViewMonth } from "./MonthlyMiniCalendar";
import { AdminManualPraemieDayWorkdayReports } from "./AdminManualPraemieDayWorkdayReports";
import {
  AdminManualPraemieQueueColumnHeaders,
  AdminManualPraemieQueueRowBody,
  AdminManualPraemieQueueTableShell,
} from "./AdminManualPraemieQueueRowTable";

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
  const [correctVal, setCorrectVal] = useState("");
  const [finalValueError, setFinalValueError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queueRow, setQueueRow] = useState<AdminManualPraemieQueueRowData | null>(
    null,
  );
  const [queueRowLoading, setQueueRowLoading] = useState(false);
  const queueFetchSeq = useRef(0);
  const selectedDateRef = useRef<string | null>(null);

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

  const load = useCallback(async (): Promise<ManualDailyEntryDto[]> => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminManualDailyMonth(userId, year, month);
      setRows(data);
      return data;
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.adminManual.loadError");
      setError(String(msg));
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, year, month, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    selectedDateRef.current = selected?.date ?? null;
  }, [selected?.date]);

  const refreshQueueRow = useCallback(
    async (date: string | null) => {
      const id = ++queueFetchSeq.current;
      if (!date) {
        setQueueRow(null);
        setQueueRowLoading(false);
        return;
      }
      setQueueRowLoading(true);
      try {
        const r = await getAdminManualPraemieDayQueueRow(userId, date);
        if (id === queueFetchSeq.current) {
          setQueueRow(r);
        }
      } catch {
        if (id === queueFetchSeq.current) {
          setQueueRow(null);
        }
      } finally {
        if (id === queueFetchSeq.current) {
          setQueueRowLoading(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    const onChanged = () => {
      void (async () => {
        const selDate = selectedDateRef.current;
        const data = await load();
        if (selDate) {
          setSelected((prev) => {
            if (!prev || prev.date !== selDate) return prev;
            return data.find((r) => r.date === selDate) ?? prev;
          });
          await refreshQueueRow(selDate);
        }
      })();
    };
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
    return () =>
      window.removeEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
  }, [load, refreshQueueRow]);

  useEffect(() => {
    if (!selected) {
      setCorrectVal("");
      setFinalValueError(false);
      void refreshQueueRow(null);
      return;
    }
    setCorrectVal("");
    setFinalValueError(false);
    void refreshQueueRow(selected.date);
  }, [selected?.date, refreshQueueRow]);

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
    const selDate = selected?.date ?? null;
    setBusy(true);
    setError("");
    try {
      await fn();
      const data = await load();
      dispatchPraemienManualPendingChanged();
      setSelected((prev) => {
        if (!prev) return null;
        return data.find((r) => r.date === prev.date) ?? null;
      });
      setCorrectVal("");
      if (selDate) {
        await refreshQueueRow(selDate);
      }
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
    <div className="mt-2 w-full min-w-0 space-y-4">
      {/* Calendario e instrucciones: ancho contenido moderado; la tabla de revisión va ancho completo abajo. */}
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <p className="text-xs text-slate-600">{t("pages.praemien.adminManual.instructions")}</p>

        {error && !selected && (
          <p className="rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-800">{error}</p>
        )}

        {loading ? (
          <p className="text-xs text-slate-600">{t("pages.praemien.adminManual.loading")}</p>
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
                setSelected((prev) => (prev?.date === key ? null : row));
              },
              isDisabled,
              valueClassName,
              dayBaseClassName,
            }}
          />
        )}

        {!loading && rows.length === 0 && (
          <p className="text-xs text-slate-500">{t("pages.praemien.adminManual.empty")}</p>
        )}
      </div>

      {selected && (
        <div className="min-w-0 w-full space-y-3">
          {error && (
            <p className="rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-800">{error}</p>
          )}
          {queueRowLoading ? (
            <p className="text-xs text-slate-500">{t("pages.praemien.adminManual.loading")}</p>
          ) : queueRow ? (
            <AdminManualPraemieQueueTableShell
              ariaLabel={t("pages.praemien.adminManual.title")}
            >
              <AdminManualPraemieQueueColumnHeaders />
              <AdminManualPraemieQueueRowBody
                row={queueRow}
                rectifyInput={correctVal}
                onRectifyChange={(value) => {
                  setCorrectVal(value);
                  setFinalValueError(false);
                }}
                finalValueError={finalValueError}
                onApprove={() => {
                  const raw = correctVal.trim();
                  if (raw === "") {
                    setFinalValueError(true);
                    return;
                  }
                  const parsed = parseManualPraemieClientValue(correctVal);
                  if (!parsed.ok) {
                    setError(t("pages.praemien.adminManual.invalidCorrect"));
                    return;
                  }
                  void run(async () => {
                    const result = await postAdminManualDailyApprove({
                      userId,
                      date: selected.date,
                      adminFinalValue: parsed.value,
                    });
                    if (queueRow) {
                      showManualApproveSuccessToast(
                        t,
                        queueRow,
                        result.syncedTeammateUserIds,
                      );
                    }
                  });
                }}
                busy={busy}
                onReopen={() =>
                  void run(async () => {
                    await postAdminManualDailyReopen({
                      userId,
                      date: selected.date,
                    });
                  })
                }
              />
            </AdminManualPraemieQueueTableShell>
          ) : (
            <p className="text-xs text-slate-500">{t("pages.praemien.adminManual.loadError")}</p>
          )}
          {selected &&
          (selected.status === "submitted" || selected.status === "reopened") ? (
            <AdminManualPraemieDayWorkdayReports
              userId={userId}
              date={selected.date}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminManualPraemienReviewPanel;
