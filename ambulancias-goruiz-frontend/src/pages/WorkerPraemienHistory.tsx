import { useEffect, useState } from "react";
import type { MonthlyPraemieHistoryItem } from "../api/praemien";
import { getPraemienMonthlyHistory } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { monthLabel } from "../utils/intl";

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

  if (loading) return <p className="p-4 text-center">{t('pages.praemien.history.loading')}</p>;
  if (history.length === 0)
    return (
      <p className="p-4 text-center text-gray-500">
        {t('pages.praemien.history.empty')}
      </p>
    );

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow mt-6">
      <h2 className="text-xl font-semibold mb-4">
        {t('pages.praemien.history.title')}
      </h2>
      <table className="table-auto border-collapse border border-gray-300 w-full text-center">
        <thead className="bg-blue-100 sticky top-0">
          <tr>
            <th className="border border-gray-300 px-4 py-2">
              {t('pages.praemien.history.table.year')}
            </th>
            <th className="border border-gray-300 px-4 py-2">
              {t('pages.praemien.history.table.month')}
            </th>
            <th className="border border-gray-300 px-4 py-2">
              {t('pages.praemien.history.table.avgPatients')}
            </th>
            <th className="border border-gray-300 px-4 py-2">
              {t('pages.praemien.history.table.level')}
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map(({ year, month, averagePatients }) => {
            // month es 1..12 -> para Date es 0..11
            const monthName = monthLabel(year, month - 1);

            let premieLevel = t('pages.praemien.levels.none');
            if (averagePatients >= 10) premieLevel = t('pages.praemien.levels.10');
            else if (averagePatients >= 9) premieLevel = t('pages.praemien.levels.9');
            else if (averagePatients >= 8) premieLevel = t('pages.praemien.levels.8');
            else if (averagePatients >= 7) premieLevel = t('pages.praemien.levels.7');

            const avgRounded = (Math.round(averagePatients * 2) / 2).toFixed(1);

            return (
              <tr key={`${year}-${month}`} className="hover:bg-blue-50">
                <td className="border border-gray-300 px-4 py-2">{year}</td>
                <td className="border border-gray-300 px-4 py-2">{monthName}</td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">{avgRounded}</td>
                <td className="border border-gray-300 px-4 py-2">{premieLevel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WorkerPraemienHistory;
