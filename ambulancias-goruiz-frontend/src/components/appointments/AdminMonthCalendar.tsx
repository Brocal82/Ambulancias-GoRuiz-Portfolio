import React, { useMemo, useState } from 'react';
import type { Appointment } from '../../types/appointment';
import {
  getMonthMatrix,
  groupAppointmentsByDay,
  ymd,
} from '../../utils/appointmentMonthUtils';
import { useTranslation } from 'react-i18next';
import DayAppointmentsModal from './DayAppointmentsModal';

type Props = {
  items: Appointment[];
  year: number;
  monthIndex: number;
  onAppointmentClick?: (a: Appointment) => void;
};

const AdminMonthCalendar: React.FC<Props> = ({
  items,
  year,
  monthIndex,
  onAppointmentClick,
}) => {
  const { t, i18n } = useTranslation();

  const cells = useMemo(() => getMonthMatrix(year, monthIndex), [year, monthIndex]);
  const grouped = useMemo(() => groupAppointmentsByDay(items), [items]);

  const monthTitle = useMemo(
    () =>
      new Date(year, monthIndex, 1).toLocaleDateString(i18n.language, {
        month: 'long',
        year: 'numeric',
      }),
    [year, monthIndex, i18n.language]
  );

  const weekdayLabels = t('pages.appointments.calendar.weekdayLabels', {
    returnObjects: true,
  }) as string[];

  // Estado modal día
  const [openDayModal, setOpenDayModal] = useState(false);
  const [dayModalDateISO, setDayModalDateISO] = useState<string | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);

  const openModalForDay = (date: Date | null) => {
    if (!date) return;
    const key = ymd(date);
    const list = grouped.get(key) ?? [];
    if (list.length === 0) return;

    setDayAppointments(list);
    setDayModalDateISO(date.toISOString());
    setOpenDayModal(true);
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
      {/* 1) Título mes/año */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 capitalize">
          {monthTitle}
        </h3>
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
          const list = cell.date ? (grouped.get(key) ?? []) : [];
          const count = list.length;
          const clickable = !!cell.date && count > 0;

          return (
            <div
              key={key}
              className={[
                'relative min-h-[96px] rounded-xl p-2 ring-1 ring-slate-200',
                cell.date ? 'bg-white' : 'bg-slate-50 opacity-80',
                clickable ? 'cursor-pointer hover:ring-blue-300 hover:bg-blue-50/30' : '',
              ].join(' ')}
              aria-label={
                cell.date
                  ? t('pages.appointments.calendar.aria.day', { num: cell.dayNumber })
                  : t('pages.appointments.calendar.aria.emptyCell')
              }
              {...(clickable && {
                role: 'button' as const,
                tabIndex: 0,
                onClick: () => openModalForDay(cell.date!),
                onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModalForDay(cell.date!);
                  }
                },
              })}
            >
              {/* Número de día */}
              <div className="mb-1 text-[11px] font-medium text-slate-500">
                {cell.dayNumber ?? ''}
              </div>

              {/* Globo con número de citas (solo si hay) */}
              {count > 0 && (
                <span
                  className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white ring-2 ring-blue-100"
                  title={`${count} ${count === 1 ? 'cita' : 'citas'}`}
                  aria-label={`${count} ${count === 1 ? 'cita' : 'citas'}`}
                >
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal reutilizable */}
      <DayAppointmentsModal
        isOpen={openDayModal}
        dateISO={dayModalDateISO}
        appointments={dayAppointments}
        onClose={() => setOpenDayModal(false)}
        onAppointmentClick={onAppointmentClick}
      />
    </div>
  );
};

export default AdminMonthCalendar;
