import { useEffect, useState } from "react";
import type { MonthlyPraemieHistoryItem } from "../api/praemien";
import { getPraemienMonthlyHistory } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { monthLabel } from "../utils/intl";
import {
  getPraemieI18nKey,
  getPraemieLevelFromAverage,
} from "../utils/praemien/praemienLevels";

interface Props {
  userId?: string;
}

const WorkerPraemienHistory = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [history, setHistory] = useState<MonthlyPraemieHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPraemienMonthlyHistory(token, userId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, userId]);

  if (loading) {
    return (
      <p className="p-3 text-center text-sm text-slate-600">
        {t("pages.praemien.history.loading")}
      </p>
    );
  }

  if (history.length === 0) {
    return (
      <p className="p-3 text-center text-sm text-slate-500">
        {t("pages.praemien.history.empty")}
      </p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-lg bg-white ring-1 ring-slate-200 p-3 md:p-4 shadow-sm">
      <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3">
        {t("pages.praemien.history.title")}
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2 border-b border-slate-200">
                {t("pages.praemien.history.table.year")}
              </th>
              <th className="px-3 py-2 border-b border-slate-200">
                {t("pages.praemien.history.table.month")}
              </th>
              <th className="px-3 py-2 border-b border-slate-200">
                {t("pages.praemien.history.table.avgPatients")}
              </th>
              <th className="px-3 py-2 border-b border-slate-200">
                {t("pages.praemien.history.table.level")}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {history.map(({ year, month, averagePatients }) => {
              // month es 1..12 -> Date usa 0..11
              const monthName = monthLabel(year, month - 1);

              const level = getPraemieLevelFromAverage(averagePatients);
              const premieLevel = t(getPraemieI18nKey(level));

              let levelClass = "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
              if (level === 10) {
                levelClass = "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
              } else if (level === 9) {
                levelClass = "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
              } else if (level === 8) {
                levelClass = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
              } else if (level === 7) {
                levelClass = "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
              }

              const avgRounded = (Math.round(averagePatients * 2) / 2).toFixed(1);

              return (
                <tr
                  key={`${year}-${month}`}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-3 py-2">{year}</td>
                  <td className="px-3 py-2">{monthName}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    {avgRounded}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${levelClass}`}
                    >
                      {premieLevel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkerPraemienHistory;
