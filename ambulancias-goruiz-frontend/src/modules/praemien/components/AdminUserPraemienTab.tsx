// src/pages/AdminUserPraemienTab.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMonthlyPraemienSummary } from "../domain/api";
import type { MonthlyPraemienDay } from "../domain/api";
import MonthlyMiniCalendar from "./MonthlyMiniCalendar";
import PraemieProgressBars from "./PraemieProgressBars";
import WorkerPraemienHistory from "./WorkerPraemienHistory";
import { useAuth } from "../../../hooks/useAuth";
interface Props {
  userId: string;
}

const AdminUserPraemienTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [averagePatients, setAveragePatients] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);

    getMonthlyPraemienSummary(userId)
      .then((data) => {
        setSummaries(data.monthlyData || []);
        setAveragePatients(data.averagePatients ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, userId]);

  if (loading) {
    return <p className="p-4">{t("pages.praemien.page.loading")}</p>;
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        {t("pages.praemien.adminUserTab.currentTitle")}
      </h2>

      {/* Barras (incluye el Global Level dentro, sin duplicar) */}
      <PraemieProgressBars averagePatients={averagePatients} days={summaries} />

      {/* Historial diario (mini-calendario) */}
      <div className="mt-6">
        <MonthlyMiniCalendar days={summaries} />
      </div>

      {/* Historial mensual (12 meses) */}
      <div className="mt-8 border-t pt-6">
        <WorkerPraemienHistory userId={userId} />
      </div>
    </div>
  );
};

export default AdminUserPraemienTab;
