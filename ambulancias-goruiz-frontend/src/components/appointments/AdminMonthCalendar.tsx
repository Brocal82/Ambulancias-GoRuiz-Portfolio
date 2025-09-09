import React, { useMemo } from 'react';
import type { Appointment } from '../../types/appointment';
import {
  getMonthMatrix,
  groupAppointmentsByDay,
  ymd,
} from '../../utils/appointmentMonthUtils';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Citas confirmadas/reprogramadas del AÑO (puedes pasar todas las del año). */
  items: Appointment[];
  /** Año a mostrar. */
  year: number;
  /** Mes a mostrar (0..11). */
  monthIndex: number;
  /** Click en una cita para abrir detalle. */
  onAppointmentClick?: (a: Appointment) => void;
};

const AdminMonthCalendar: React.FC<Props> = ({
  items,
  year,
  monthIndex,
  onAppointmentClick,
}) => {
  const { t, i18n } = useTranslation();

  // Matriz de celdas del mes (con padding para empezar en lunes)
  const cells = useMemo(() => getMonthMatrix(year, monthIndex), [year, monthIndex]);
  // Agrupamos por día en TZ Berlin
  const grouped = useMemo(() => groupAppointmentsByDay(items), [items]);

  // Nombre de mes/año en el idioma activo
  const monthTitle = useMemo(
    () =>
      new Date(year, monthIndex, 1).toLocaleDateString(i18n.language, {
        month: 'long',
        year: 'numeric',
      }),
    [year, monthIndex, i18n.language]
  );

  // Etiquetas de días (L-M-… o según idioma); viene del JSON
  const weekdayLabels = t('pages.appointments.calendar.weekdayLabels', {
    returnObjects: true,
  }) as string[];

return (
  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
    {/* 1) Título mes/año */}
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900 capitalize">
        {monthTitle}
      </h3>
      {/* Botones prev/next opcionales aquí */}
    </div>

    {/* 2) Cabecera de días */}
    <div className="mb-3 grid grid-cols-7 gap-2">
      {weekdayLabels.map((w, i) => (
        <div
          key={`${w}-${i}`}
          className="text-[11px] font-medium uppercase tracking-wide text-slate-500 text-center"
        >
          {w}
        </div>
      ))}
    </div>

    {/* 3) Cuadrícula de días */}
    <div className="grid grid-cols-7 gap-2">
      {cells.map((cell, idx) => {
        const key = cell.date ? ymd(cell.date) : `empty-${idx}`;
        const dayAppointments = cell.date ? (grouped.get(key) ?? []) : [];

        return (
          <div
            key={key}
            className={[
              'relative min-h-[96px] rounded-xl p-2',
              'ring-1 ring-slate-200',
              cell.date ? 'bg-white' : 'bg-slate-50 opacity-80'
            ].join(' ')}
            aria-label={
              cell.date
                ? t('pages.appointments.calendar.aria.day', { num: cell.dayNumber })
                : t('pages.appointments.calendar.aria.emptyCell')
            }
          >
            {/* Número de día */}
            <div className="mb-1 text-[11px] font-medium text-slate-500">
              {cell.dayNumber ?? ''}
            </div>

            {/* Citas del día */}
            <div className="space-y-1">
              {dayAppointments.map((a) => {
                const when = a.selectedSlot?.start
                  ? new Date(a.selectedSlot.start).toLocaleTimeString('de-DE', {
                      timeZone: 'Europe/Berlin',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                const worker =
                  typeof a.workerId === 'object'
                    ? `${a.workerId.lastName}, ${a.workerId.name}`
                    : t('pages.appointments.calendar.workerFallback');

                const aria = t('pages.appointments.calendar.aria.appointment', {
                  worker,
                  time: when,
                });

                return (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => onAppointmentClick?.(a)}
                    className={[
                      'group w-full truncate rounded-md px-2 py-1 text-left text-xs font-medium',
                      'bg-blue-50 text-blue-700 hover:bg-blue-100',
                      'focus:outline-none focus:ring-4 focus:ring-blue-100'
                    ].join(' ')}
                    title={aria}
                    aria-label={aria}
                  >
                    <span className="truncate">{when} · {worker}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

};

export default AdminMonthCalendar;
