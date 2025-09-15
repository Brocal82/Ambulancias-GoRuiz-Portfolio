import React from 'react';
import type { Appointment } from '../../types/appointment';
import {
  getYearMonths,
  countAppointmentsByMonth,
} from '../../utils/appointmentMonthUtils';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Citas confirmadas/reprogramadas del año (pueden venir de la API de calendario). */
  items: Appointment[];
  /** Año a mostrar (por defecto, el año actual). */
  year?: number;
  /** Callback cuando se hace clic en un mes (0..11). */
  onMonthClick?: (monthIndex: number) => void;
};

const AdminAppointmentMonthGrid: React.FC<Props> = ({
  items,
  year = new Date().getFullYear(),
  onMonthClick,
}) => {
  const { t, i18n } = useTranslation();
  const months = getYearMonths(year, i18n.language);

  const counts = countAppointmentsByMonth(items, year);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">
          {t('pages.appointments.monthGrid.title', { year })}
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
  aria-label={t('pages.appointments.monthGrid.ariaOpenMonth', {
    label,
    year,
  })}
  className={[
    'group relative rounded-xl p-3 transition',
    'ring-1 ring-slate-200 hover:shadow-sm hover:-translate-y-0.5',
    hasItems ? 'bg-white' : 'bg-slate-50 opacity-90 hover:opacity-100',
    'focus:outline-none focus:ring-4 focus:ring-blue-100',
    'flex flex-col items-center justify-center text-center min-h-[70px]',
  ].join(' ')}
>
  {/* Mes */}
  <span className="text-sm font-medium text-slate-900">{label}</span>

  {/* Badge con el número de citas */}
  <span
    className={[
      'mt-1 inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-medium',
      hasItems
        ? 'bg-blue-50 text-blue-700 group-hover:bg-blue-100'
        : 'bg-slate-100 text-slate-600',
    ].join(' ')}
  >
    {t('pages.appointments.monthGrid.count', { count })}
  </span>
</button>

          );
        })}
      </div>
    </div>
  );
};

export default AdminAppointmentMonthGrid;
