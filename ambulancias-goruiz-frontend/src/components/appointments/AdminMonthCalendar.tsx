import React, { useMemo } from 'react';
import type { Appointment } from '../../types/appointment';
import {
  getMonthMatrix,
  groupAppointmentsByDay,
  ymd,
} from '../../utils/appointmentMonthUtils';

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

const weekdayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const AdminMonthCalendar: React.FC<Props> = ({
  items,
  year,
  monthIndex,
  onAppointmentClick,
}) => {
  // Matriz de celdas del mes (con padding para empezar en lunes)
  const cells = useMemo(() => getMonthMatrix(year, monthIndex), [year, monthIndex]);
  // Agrupamos por día en TZ Berlin
  const grouped = useMemo(() => groupAppointmentsByDay(items), [items]);

  const monthTitle = useMemo(
    () =>
      new Date(year, monthIndex, 1)
        .toLocaleString('es-ES', { month: 'long', year: 'numeric' })
        .replace(/^\p{L}/u, c => c.toUpperCase()),
    [year, monthIndex]
  );

  return (
  <div className="bg-white rounded-2xl shadow p-4">
    {/* 1) Título mes/año: en su propia fila */}
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold capitalize">{monthTitle}</h3>
      {/* Si tienes botones prev/next, colócalos aquí a la derecha */}
    </div>

    {/* 2) Cabecera de días: grid de 7 columnas, separada del título */}
    <div className="grid grid-cols-7 gap-2 mb-2">
      {weekdayLabels.map((w) => (
        <div key={w} className="text-xs text-gray-500 text-center">
          {w}
        </div>
      ))}
    </div>

    {/* 3) Cuadrícula de días: misma grid de 7 columnas */}
    <div className="grid grid-cols-7 gap-2">
      {cells.map((cell, idx) => {
        const key = cell.date ? ymd(cell.date) : `empty-${idx}`;
        const dayAppointments = cell.date ? (grouped.get(key) ?? []) : [];

        return (
          <div
            key={key}
            className={[
              'relative min-h-[90px] rounded-lg border p-2',
              cell.date ? 'bg-white' : 'bg-gray-50 opacity-60',
            ].join(' ')}
            aria-label={cell.date ? `Día ${cell.dayNumber}` : 'Celda vacía'}
          >
            {/* Número de día */}
            <div className="text-xs text-gray-500 mb-1">{cell.dayNumber ?? ''}</div>

            {/* Citas del día */}
            <div className="space-y-1">
              {dayAppointments.map((a) => {
                const when =
                  a.selectedSlot?.start
                    ? new Date(a.selectedSlot.start).toLocaleTimeString('de-DE', {
                        timeZone: 'Europe/Berlin',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                const worker =
                  typeof a.workerId === 'object'
                    ? `${a.workerId.lastName}, ${a.workerId.name}`
                    : 'Trabajador';

                return (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => onAppointmentClick?.(a)}
                    className="group w-full truncate rounded-md bg-orange-100 px-2 py-1 text-left text-xs text-orange-800 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    title={`${worker} · ${when}`}
                    aria-label={`Cita: ${worker} a las ${when}`}
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
