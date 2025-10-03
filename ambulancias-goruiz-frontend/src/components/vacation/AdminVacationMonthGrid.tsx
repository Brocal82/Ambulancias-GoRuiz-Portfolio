import React, { useEffect, useMemo, useState } from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { getYearMonths, countRequestsByMonth } from '../../utils/vacationMonthUtils';
import { useTranslation } from 'react-i18next';

// API disponibilidad
import {
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from '../../api/vacation';

type Props = {
  requests: IVacationRequest[];
  year?: number;
  onMonthClick?: (monthIndex: number) => void; // compatibilidad
  // NUEVOS opcionales:
  onYearChange?: (year: number) => void;
  onMonthOpen?: (monthIndex: number, year: number) => void;
};

type MonthAvailabilitySummary = {
  green: number;
  yellow: number;
  red: number;
  maxPerDay: number;
  loaded: boolean;
  error?: string;
};

const AdminVacationMonthGrid: React.FC<Props> = ({
  requests,
  year = new Date().getFullYear(),
  onMonthClick,
  onYearChange,
  onMonthOpen,
}) => {
  const { t, i18n } = useTranslation();

  // ---- Año local con controles ----
  const [localYear, setLocalYear] = useState<number>(year);
  useEffect(() => {
    setLocalYear(year); // si desde fuera te cambian 'year', sincroniza
  }, [year]);

  const handleYearDelta = (delta: number) => {
    const next = localYear + delta;
    setLocalYear(next);
    onYearChange?.(next);
  };
  const handleYearInput = (val: string) => {
    const n = Number(val);
    if (!Number.isNaN(n) && n >= 1900 && n <= 3000) {
      setLocalYear(n);
      onYearChange?.(n);
    }
  };

  const months = getYearMonths(localYear, i18n.language);
  const counts = countRequestsByMonth(requests, localYear);

  // Disponibilidad por mes (resumen)
  const [availabilityByMonth, setAvailabilityByMonth] = useState<
    Record<number, MonthAvailabilitySummary>
  >({});
  const initialSummary: MonthAvailabilitySummary = useMemo(
    () => ({ green: 0, yellow: 0, red: 0, maxPerDay: 0, loaded: false }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const promises = months.map(async ({ monthIndex }) => {
          const month1to12 = monthIndex + 1;
          const data: VacationAvailabilityResponse = await getVacationAvailability({
            year: localYear,
            month: month1to12,
          });

          const summary = data.days.reduce(
            (acc, d) => {
              if (d.state === 'green') acc.green += 1;
              else if (d.state === 'yellow') acc.yellow += 1;
              else acc.red += 1;
              return acc;
            },
            { green: 0, yellow: 0, red: 0 }
          );

          return { monthIndex, summary: { ...summary, maxPerDay: data.maxPerDay, loaded: true } };
        });

        const results = await Promise.allSettled(promises);
        if (cancelled) return;

        const next: Record<number, MonthAvailabilitySummary> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') {
            next[r.value.monthIndex] = r.value.summary;
          }
        }
        months.forEach(({ monthIndex }) => {
          if (!next[monthIndex]) {
            next[monthIndex] = { ...initialSummary, loaded: true, error: 'load_error' };
          }
        });

        setAvailabilityByMonth(next);
      } catch {
        if (!cancelled) {
          const fallback: Record<number, MonthAvailabilitySummary> = {};
          months.forEach(({ monthIndex }) => {
            fallback[monthIndex] = { ...initialSummary, loaded: true, error: 'load_error' };
          });
          setAvailabilityByMonth(fallback);
        }
      }
    }

    setAvailabilityByMonth({}); // limpia al cambiar de año
    loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localYear, i18n.language]);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">
          {t('pages.vacations.monthGrid.title', { year: localYear })}
        </h3>

        {/* ---- Controles de año ---- */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleYearDelta(-1)}
            className="rounded-lg px-2.5 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50"
            aria-label={t('common.prev', 'Anterior')}
            title={t('common.prev', 'Anterior') as string}
          >
            ←
          </button>
          <input
            type="number"
            min={1900}
            max={3000}
            value={localYear}
            onChange={(e) => handleYearInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-4 focus:ring-blue-100"
            aria-label={t('common.year', 'Año') as string}
            title={t('common.year', 'Año') as string}
          />
          <button
            type="button"
            onClick={() => handleYearDelta(1)}
            className="rounded-lg px-2.5 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50"
            aria-label={t('common.next', 'Siguiente')}
            title={t('common.next', 'Siguiente') as string}
          >
            →
          </button>
        </div>

        {/* Leyenda compacta */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-green-500" />
            {t('common.available', 'Disponible')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-yellow-400" />
            {t('common.requested', 'Solicitado')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-500" />
            {t('common.full', 'Completo')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map(({ monthIndex, label }) => {
          const count = counts[monthIndex] ?? 0;
          const hasItems = count > 0;

          const avail = availabilityByMonth[monthIndex] ?? initialSummary;
          const loaded = avail.loaded;
          const disabledStyle = !loaded ? 'opacity-80' : '';

          // Busca esta función y déjala así:
          const openMonth = () => {
            onMonthOpen?.(monthIndex, localYear); // <-- SOLO este
            // ❌ Quita/evita: onMonthClick?.(monthIndex)
          };

          return (
            <button
              key={monthIndex}
              type="button"
              onClick={openMonth}
              aria-label={t('pages.vacations.monthGrid.ariaOpenMonth', { label, year: localYear })}
              className={[
                'group relative rounded-xl p-3 transition',
                'ring-1 ring-slate-200 hover:shadow-sm hover:-translate-y-0.5',
                hasItems ? 'bg-white' : 'bg-slate-50 hover:opacity-100',
                'focus:outline-none focus:ring-4 focus:ring-blue-100',
                'flex flex-col items-stretch justify-between min-h-[90px]',
                disabledStyle,
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">{label}</span>
                <span
                  className={[
                    'ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium',
                    hasItems ? 'bg-blue-50 text-blue-700 group-hover:bg-blue-100' : 'bg-slate-100 text-slate-600',
                  ].join(' ')}
                  title={t('pages.vacations.monthGrid.count', { count }) as string}
                  aria-label={t('pages.vacations.monthGrid.count', { count }) as string}
                >
                  {t('pages.vacations.monthGrid.count', { count })}
                </span>
              </div>

              {/* Resumen barras apiladas (SVG, sin inline style) */}
              <div className="mt-3">
                {loaded ? (
                  (() => {
                    const total = Math.max(1, avail.green + avail.yellow + avail.red);
                    const gw = (avail.green / total) * 100;
                    const yw = (avail.yellow / total) * 100;
                    const rw = (avail.red / total) * 100;
                    return (
                      <div className="space-y-2">
                        <div className="w-full h-2.5 rounded bg-slate-100 overflow-hidden">
                          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="w-full h-full block">
                            <rect x={0} y={0} width={gw} height={10} className="fill-green-500">
                              <title>{`${avail.green} ${t('common.daysAvailable', 'días disponibles')}`}</title>
                            </rect>
                            <rect x={gw} y={0} width={yw} height={10} className="fill-yellow-400">
                              <title>{`${avail.yellow} ${t('common.daysRequested', 'días solicitados')}`}</title>
                            </rect>
                            <rect x={gw + yw} y={0} width={rw} height={10} className="fill-red-500">
                              <title>{`${avail.red} ${t('common.daysFull', 'días completos')}`}</title>
                            </rect>
                          </svg>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded bg-green-500" />
                            {avail.green}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded bg-yellow-400" />
                            {avail.yellow}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded bg-red-500" />
                            {avail.red}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-2 animate-pulse">
                    <div className="w-full h-2.5 rounded bg-slate-100" />
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-slate-200" />
                        —
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-slate-200" />
                        —
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-slate-200" />
                        —
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminVacationMonthGrid;
