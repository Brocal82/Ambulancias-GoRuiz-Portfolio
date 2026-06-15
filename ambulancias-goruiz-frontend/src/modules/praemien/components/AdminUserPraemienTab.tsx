// src/pages/AdminUserPraemienTab.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMonthlyPraemienSummary } from "../domain/api";
import type { MonthlyPraemienDay } from "../domain/api";
import { getAdminManualDailyMonth } from "../domain/manualDailyApi";
import MonthlyMiniCalendar from "./MonthlyMiniCalendar";
import PraemieProgressBars from "./PraemieProgressBars";
import WorkerPraemienHistory from "./WorkerPraemienHistory";
import AdminManualPraemienReviewPanel from "./AdminManualPraemienReviewPanel";
import { usePraemienDienstDayTints } from "../hooks/usePraemienDienstDayTints";
import { useAuth } from "../../../hooks/useAuth";
import { MODULE_KEYS } from "../../../constants/modules";
import { isPraemienManualEntryPhaseActive } from "../utils/isPraemienManualEntryPhaseActive";
import { manualMonthSummaryFromEntries } from "../utils/manualMonthSummaryFromEntries";
import { PRAEMIEN_MANUAL_PENDING_CHANGED } from "../utils/praemienManualPendingEvents";

interface Props {
  userId: string;
}

/** Calendario resumen (modo no manual): tints Dienst sin duplicar fetch con el panel de revisión. */
function AdminAutomaticPraemieCalendarView({
  userId,
  days,
}: {
  userId: string;
  days: MonthlyPraemienDay[];
}) {
  const { dayBaseClassName } = usePraemienDienstDayTints(userId);
  return (
    <div className="mx-auto mt-6 max-w-4xl">
      <MonthlyMiniCalendar
        days={days}
        dayBaseClassName={dayBaseClassName}
      />
    </div>
  );
}

const AdminUserPraemienTab = ({ userId }: Props) => {
  const { token, praemienMode, praemienModeEffectiveFrom, enabledModules, role } =
    useAuth();
  const { t } = useTranslation();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [averagePatients, setAveragePatients] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const manualEffective = useMemo(() => {
    const praemienEnabled =
      role === "superadmin" ||
      enabledModules === null ||
      (Array.isArray(enabledModules) &&
        enabledModules.includes(MODULE_KEYS.PRAEMIEN));
    return isPraemienManualEntryPhaseActive({
      praemienEnabled,
      praemienMode,
      praemienModeEffectiveFrom,
    });
  }, [role, enabledModules, praemienMode, praemienModeEffectiveFrom]);

  const reloadSummary = useCallback(() => {
    if (!token || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSummaryError("");

    void (async () => {
      try {
        if (manualEffective) {
          const now = new Date();
          const entries = await getAdminManualDailyMonth(
            userId,
            now.getFullYear(),
            now.getMonth() + 1,
          );
          const { days, averagePatients } = manualMonthSummaryFromEntries(entries);
          setSummaries(days);
          setAveragePatients(averagePatients);
          return;
        }

        const data = await getMonthlyPraemienSummary(userId);
        setSummaries(data.monthlyData || []);
        setAveragePatients(data.averagePatients ?? 0);
      } catch {
        setSummaryError(t("pages.praemien.page.error"));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, userId, t, manualEffective]);

  useEffect(() => {
    reloadSummary();
  }, [reloadSummary]);

  useEffect(() => {
    const onChanged = () => reloadSummary();
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
    return () =>
      window.removeEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
  }, [reloadSummary]);

  if (!manualEffective && loading) {
    return <p className="p-4">{t("pages.praemien.page.loading")}</p>;
  }

  if (!manualEffective && summaryError) {
    return <p className="p-4 text-red-600">{summaryError}</p>;
  }

  return (
    <div className="min-w-0 w-full bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        {t("pages.praemien.adminUserTab.currentTitle")}
      </h2>

      {manualEffective ? (
        <>
          {summaryError && (
            <p className="mb-4 text-sm text-amber-900">
              {t("pages.praemien.page.summaryErrorHint")}
            </p>
          )}

          {!summaryError && !loading && (
            <PraemieProgressBars
              averagePatients={averagePatients}
              days={summaries}
            />
          )}

          {!summaryError && loading && (
            <p className="mb-4 text-sm text-slate-500">
              {t("pages.praemien.page.summaryLoading")}
            </p>
          )}

          <div className={summaryError || loading ? "mt-4" : "mt-6"}>
            <AdminManualPraemienReviewPanel
              userId={userId}
              effectiveFrom={praemienModeEffectiveFrom}
            />
          </div>
        </>
      ) : (
        <>
          <PraemieProgressBars averagePatients={averagePatients} days={summaries} />
          <AdminAutomaticPraemieCalendarView userId={userId} days={summaries} />
        </>
      )}

      <div className="mt-8 border-t pt-6">
        <WorkerPraemienHistory userId={userId} />
      </div>
    </div>
  );
};

export default AdminUserPraemienTab;
