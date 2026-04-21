// src/pages/AdminUserPraemienTab.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMonthlyPraemienSummary } from "../domain/api";
import type { MonthlyPraemienDay } from "../domain/api";
import MonthlyMiniCalendar from "./MonthlyMiniCalendar";
import PraemieProgressBars from "./PraemieProgressBars";
import WorkerPraemienHistory from "./WorkerPraemienHistory";
import AdminManualPraemienReviewPanel from "./AdminManualPraemienReviewPanel";
import { useAuth } from "../../../hooks/useAuth";
import { MODULE_KEYS } from "../../../constants/modules";
import { isPraemienManualEntryPhaseActive } from "../utils/isPraemienManualEntryPhaseActive";

interface Props {
  userId: string;
}

const AdminUserPraemienTab = ({ userId }: Props) => {
  const { token, praemienMode, praemienModeEffectiveFrom, enabledModules, role } =
    useAuth();
  const { t } = useTranslation();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [averagePatients, setAveragePatients] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!token || !userId || manualEffective) {
      setLoading(false);
      return;
    }
    setLoading(true);

    getMonthlyPraemienSummary(userId)
      .then((data) => {
        setSummaries(data.monthlyData || []);
        setAveragePatients(data.averagePatients ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, userId, manualEffective]);

  if (!manualEffective && loading) {
    return <p className="p-4">{t("pages.praemien.page.loading")}</p>;
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        {t("pages.praemien.adminUserTab.currentTitle")}
      </h2>

      {manualEffective ? (
        <AdminManualPraemienReviewPanel userId={userId} />
      ) : (
        <>
          <PraemieProgressBars averagePatients={averagePatients} days={summaries} />
          <div className="mt-6">
            <MonthlyMiniCalendar days={summaries} />
          </div>
        </>
      )}

      <div className="mt-8 border-t pt-6">
        <WorkerPraemienHistory userId={userId} />
      </div>
    </div>
  );
};

export default AdminUserPraemienTab;
