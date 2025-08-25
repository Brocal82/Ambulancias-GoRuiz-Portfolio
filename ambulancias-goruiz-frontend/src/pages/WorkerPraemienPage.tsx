//src/pages/WorkerPraemienPage.tsx
import { useEffect, useState } from 'react';
import { getMonthlyPraemienSummary } from '../api/praemien';
import type { MonthlyPraemienDay } from '../api/praemien';
import { saveMonthlyPraemie } from '../api/praemienHistory';
import WorkerPraemienHistory from './WorkerPraemienHistory';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../utils/intl';

const PRAMIEN_LEVELS = [7, 8, 9, 10];

const WorkerPraemienPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [media, setMedia] = useState(0);
  const [premieLevel, setPremieLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError('');

    getMonthlyPraemienSummary(token)
      .then((data) => {
        setSummaries(data.monthlyData);
        setMedia(data.averagePatients);
      })
      .catch(() => {
        setError(t('pages.praemien.page.error'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, t]);

  // Determina el nivel global mostrado (solo cambia el texto)
  useEffect(() => {
    if (media >= 10) setPremieLevel(t('pages.praemien.levels.10'));
    else if (media >= 9) setPremieLevel(t('pages.praemien.levels.9'));
    else if (media >= 8) setPremieLevel(t('pages.praemien.levels.8'));
    else if (media >= 7) setPremieLevel(t('pages.praemien.levels.7'));
    else setPremieLevel(t('pages.praemien.levels.none'));
  }, [media, t]);

  // Guarda el resumen mensual (mantenemos la lógica; guardamos la etiqueta localizada actual)
  useEffect(() => {
    if (!token) return;
    if (media === 0) return;

    const now = new Date();
    const monthString = now.toISOString().slice(0, 7); // 'YYYY-MM'

    saveMonthlyPraemie(token, {
      month: monthString,
      averagePatients: media,
      premieLevel,
    })
      .then(() => {
        // ok
      })
      .catch(() => {
        // silent warning, como antes
        console.warn('No se pudo guardar el resumen mensual.');
      });
  }, [media, premieLevel, token]);

  // Calcula % cumplimiento y diferencia media diaria
  const calculatePraemieStats = (threshold: number) => {
    let totalDifference = 0;
    summaries.forEach((day) => {
      totalDifference += day.totalCountedPatients - threshold;
    });
    const totalDays = summaries.length || 1; // evitar división por cero
    const averageDiff = totalDifference / totalDays;

    const percentage = Math.min(100, Math.max(0, (media / threshold) * 100));

    return {
      percentage,
      averageDiff: Math.round(averageDiff * 2) / 2, // redondeo a múltiplos de 0.5
    };
  };

  if (loading) return <p className="p-4 text-center">{t('pages.praemien.page.loading')}</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-700">
        {t('pages.praemien.page.title')}
      </h1>

      {/* Nivel global alcanzado */}
      {media > 0 && (
        <p className="text-center text-lg font-semibold mb-8">
          {t('pages.praemien.page.globalLevel')}{' '}
          <span className="text-blue-700">{premieLevel}</span>
        </p>
      )}

      {/* Barras de prämien */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 mb-8">
        {PRAMIEN_LEVELS.map((level) => {
          const { percentage, averageDiff } = calculatePraemieStats(level);
          const isPositive = averageDiff >= 0;

          return (
            <div key={level} className="mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-lg">
                  {t('pages.praemien.page.patientsPerDay', { level })}
                </span>
                <span
                  className={`font-mono text-xl ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {averageDiff}
                </span>
              </div>

              {/* Barra */}
              <div className="w-full h-6 rounded bg-gray-300 overflow-hidden">
                <div
                  className={`h-6 rounded bg-gradient-to-r ${
                    isPositive ? 'from-green-400 to-green-600' : 'from-red-400 to-red-600'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial diario */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('pages.praemien.page.dailyHistoryTitle')}</h2>

        <div className="overflow-y-auto max-h-96 border rounded">
          <table className="w-full text-left table-auto border-collapse">
            <thead className="bg-blue-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 border-b border-blue-300">
                  {t('pages.praemien.page.table.date')}
                </th>
                <th className="px-4 py-2 border-b border-blue-300">
                  {t('pages.praemien.page.table.patients')}
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ date, totalCountedPatients }) => (
                <tr key={date} className="hover:bg-blue-50 transition-colors cursor-default">
                  <td className="px-4 py-2 border-b border-gray-200">
                    {formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-200 font-semibold">
                    {totalCountedPatients}
                  </td>
                </tr>
              ))}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-6 text-gray-400">
                    {t('pages.praemien.page.table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <WorkerPraemienHistory />
    </div>
  );
};

export default WorkerPraemienPage;

