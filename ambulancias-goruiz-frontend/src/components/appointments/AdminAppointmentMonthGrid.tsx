import React from 'react';
import type { Appointment } from '../../types/appointment';
import {
  getYearMonths,
  countAppointmentsByMonth,
} from '../../utils/appointmentMonthUtils';

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
  const months = getYearMonths(year);
  const counts = countAppointmentsByMonth(items, year);

  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Citas por mes · {year}</h3>
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
              aria-label={`Abrir mes ${label} ${year}`}
              className={[
                'group relative flex flex-col items-start justify-between rounded-xl border p-4 text-left transition',
                hasItems
                  ? 'border-gray-200 hover:border-blue-400 hover:shadow'
                  : 'border-gray-200 opacity-60 hover:opacity-80 hover:border-gray-300',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              ].join(' ')}
            >
              <span className="text-base font-medium capitalize">
                {label}
              </span>

              <span
                className={[
                  'mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium',
                  hasItems
                    ? 'bg-blue-50 text-blue-700 group-hover:bg-blue-100'
                    : 'bg-gray-100 text-gray-600',
                ].join(' ')}
              >
                {count} {count === 1 ? 'cita' : 'citas'}
              </span>

              {!hasItems && (
                <span className="absolute right-3 top-3 text-xs text-gray-400">
                  Vacío
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminAppointmentMonthGrid;
