// src/pages/WorkerPraemienPage.tsx
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
  if (error) return <p className="p-4 text-center text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-center mb-4">
          {t('pages.praemien.page.title')}
        </h1>

        {/* Nivel global alcanzado */}
        {media > 0 && (
          <p className="text-center text-sm text-slate-700 mb-6">
            {t('pages.praemien.page.globalLevel')}{' '}
            <span className="font-semibold text-blue-600">{premieLevel}</span>
          </p>
        )}

        {/* Barras de prämien */}
        <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 mb-8">
          {PRAMIEN_LEVELS.map((level) => {
            const { percentage, averageDiff } = calculatePraemieStats(level);
            const isPositive = averageDiff >= 0;

            return (
              <div key={level} className="mb-5 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-800">
                    {t('pages.praemien.page.patientsPerDay', { level })}
                  </span>
                  <span
                    className={`font-mono ${isPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}
                  >
                    {isPositive ? '+' : ''}
                    {averageDiff}
                  </span>
                </div>

                {/* Barra de progreso estilizada */}
                <div className="w-full h-3 rounded-full bg-slate-200 ring-1 ring-slate-300 overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'
                      } transition-[width]`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Historial diario */}
       <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
  <h2 className="text-lg font-semibold text-slate-900 mb-4">
    {t('pages.praemien.page.dailyHistoryTitle')}
  </h2>

  <div className="overflow-y-auto max-h-96 rounded-xl ring-1 ring-slate-200">
    <table className="w-full table-fixed">
      <colgroup>
        <col className="w-1/2" />
        <col className="w-1/2" />
      </colgroup>

      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr className="text-center">
          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
            {t('pages.praemien.page.table.date')}
          </th>
          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
            {t('pages.praemien.page.table.patients')}
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-200">
        {summaries.map(({ date, totalCountedPatients }) => (
          <tr key={date} className="hover:bg-blue-50/50 transition-colors text-center">
            <td className="px-4 py-2 text-sm text-slate-800">
              {formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </td>
            <td className="px-4 py-2 text-sm font-semibold text-slate-900 tabular-nums">
              {totalCountedPatients}
            </td>
          </tr>
        ))}

        {summaries.length === 0 && (
          <tr>
            <td colSpan={2} className="text-center py-6 text-slate-400">
              {t('pages.praemien.page.table.empty')}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>


        {/* Historial mensual (componente existente) */}
        <div className="mx-auto max-w-3xl mt-8">
          <WorkerPraemienHistory />
        </div>
      </div>
    </div>
  );
};

export default WorkerPraemienPage;
