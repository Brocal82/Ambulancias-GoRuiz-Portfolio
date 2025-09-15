import React, { useMemo } from 'react';
import type { Appointment } from '../../types/appointment';
import { useTranslation } from 'react-i18next';

type Props = {
  isOpen: boolean;
  dateISO: string | null;
  appointments: Appointment[];
  onClose: () => void;
  onAppointmentClick?: (a: Appointment) => void;
};

const DayAppointmentsModal: React.FC<Props> = ({
  isOpen,
  dateISO,
  appointments,
  onClose,
  onAppointmentClick,
}) => {
  const { t, i18n } = useTranslation();

  const titleDate = useMemo(() => {
    if (!dateISO) return '';
    const d = new Date(dateISO);
    return d.toLocaleDateString(i18n.language, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [dateISO, i18n.language]);

  // Orden por hora ascendente
  const sorted = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const sa = a.selectedSlot?.start ? new Date(a.selectedSlot.start).getTime() : 0;
      const sb = b.selectedSlot?.start ? new Date(b.selectedSlot.start).getTime() : 0;
      return sa - sb;
    });
  }, [appointments]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-appts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h4 id="day-appts-title" className="text-lg font-semibold tracking-tight text-slate-900">
            {t('pages.appointments.calendar.dayAppointmentsTitle') || 'Citas del día'}
          </h4>
          <div className="text-sm text-slate-500">{titleDate}</div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('pages.appointments.calendar.noAppointments') || 'No hay citas para este día.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {sorted.map((a) => {
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

                return (
                  <li key={a._id} className="py-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onAppointmentClick?.(a);
                      }}
                      className="flex w-full items-center justify-between gap-3 text-left rounded-xl px-3 py-2 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                      title={`${when} · ${worker}`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {when} · {worker}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            {t('pages.appointments.calendar.actions.close') || 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayAppointmentsModal;
