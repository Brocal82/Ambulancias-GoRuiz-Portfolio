// src/components/vacation/AdminVacationMonthGrid.tsx
import React from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { getYearMonths, countRequestsByMonth } from '../../utils/vacationMonthUtils';
import { useTranslation } from 'react-i18next';

type Props = {
  requests: IVacationRequest[];
  year?: number;
  onMonthClick?: (monthIndex: number) => void;
};

const AdminVacationMonthGrid: React.FC<Props> = ({
  requests,
  year = new Date().getFullYear(),
  onMonthClick,
}) => {
  const { t, i18n } = useTranslation();

  const months = getYearMonths(year, i18n.language);
  const counts = countRequestsByMonth(requests, year);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">
          {t('pages.vacations.monthGrid.title', { year })}
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map(({ monthIndex, label }) => {
          const count = counts[monthIndex] ?? 0;
          const hasItems = count > 0;

          return (
            <button
              key={monthIndex}
              type="button"
              onClick={() => onMonthClick?.(monthIndex)}
              aria-label={t('pages.vacations.monthGrid.ariaOpenMonth', { label, year })}
              className={[
                // === Mismo tamaño/estilo que el grid de citas ===
                'group relative rounded-xl p-3 transition',
                'ring-1 ring-slate-200 hover:shadow-sm hover:-translate-y-0.5',
                hasItems ? 'bg-white' : 'bg-slate-50 opacity-90 hover:opacity-100',
                'focus:outline-none focus:ring-4 focus:ring-blue-100',
                'flex flex-col items-center justify-center text-center min-h-[70px]',
              ].join(' ')}
            >
              {/* Mes centrado */}
              <span className="text-sm font-medium text-slate-900">{label}</span>

              {/* Badge SIEMPRE visible (0 incluido), compacto */}
              <span
                className={[
                  'mt-1 inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-medium',
                  hasItems ? 'bg-blue-50 text-blue-700 group-hover:bg-blue-100' : 'bg-slate-100 text-slate-600',
                ].join(' ')}
                title={t('pages.vacations.monthGrid.count', { count }) as string}
                aria-label={t('pages.vacations.monthGrid.count', { count }) as string}
              >
                {t('pages.vacations.monthGrid.count', { count })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminVacationMonthGrid;
