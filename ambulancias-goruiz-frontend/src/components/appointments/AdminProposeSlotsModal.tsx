import { useEffect, useMemo, useState } from 'react';
import { proposeSlots } from '../../api/appointments';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { APP_TZ } from '../../config/app';
import { localDateTimeToUtcISO } from '../../utils/tz';

interface Props {
  appointmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // recargar pendientes
  defaultDurationMinutes?: number; // p. ej. 30
}

type SlotRow = { date: string; time: string };

export default function AdminProposeSlotsModal({
  appointmentId,
  isOpen,
  onClose,
  onSuccess,
  defaultDurationMinutes = 30,
}: Props) {
  const { token } = useAuth();

  const emptyRows: SlotRow[] = [
    { date: '', time: '' },
    { date: '', time: '' },
    { date: '', time: '' },
  ];

  const [rows, setRows] = useState<SlotRow[]>(emptyRows);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRows(emptyRows);
  }, [isOpen]);

  // Construimos slots con duración por defecto (sin input de duración)
  const computed = useMemo(() => {
    const slots = rows
      .filter((r) => r.date && r.time)
      .map((r) => localDateTimeToUtcISO(APP_TZ, r.date, r.time, defaultDurationMinutes))
      .filter((x): x is NonNullable<ReturnType<typeof localDateTimeToUtcISO>> => !!x);
    return slots;
  }, [rows, defaultDurationMinutes]);

  const canSubmit = computed.length > 0;

  const validate = () => {
    if (!canSubmit) {
      throw new Error('Debes completar al menos 1 opción con fecha y hora.');
    }
    const now = Date.now();
    const sorted = [...computed].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      if (s.start.getTime() <= now) {
        throw new Error('No se pueden proponer horarios en el pasado.');
      }
      if (s.end <= s.start) {
        throw new Error('Cada opción debe tener start < end.');
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.end > s.start) {
          throw new Error('Las opciones no deben solaparse. Ajusta las horas.');
        }
      }
    }
    return sorted;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const sorted = validate();
      await proposeSlots(
        appointmentId,
        {
          proposedSlots: sorted.map((s) => ({ start: s.startISO, end: s.endISO })),
        },
        token!
      );
      toast.success('Opciones propuestas.');
      onClose();
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Error al proponer opciones.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg" role="dialog" aria-modal="true" aria-labelledby="propose-title">
        <div className="px-6 py-4 border-b">
          <h2 id="propose-title" className="text-lg font-semibold">Propuestas</h2>
        </div>
          

        <div className="px-6 py-4 space-y-4">
          {rows.map((row, idx) => {
            const dateId = `slot-date-${idx}`;
            const timeId = `slot-time-${idx}`;

            return (
              <fieldset key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-labelledby={`slot-legend-${idx}`}>
                <legend id={`slot-legend-${idx}`} className="sr-only">
                  Opción {idx + 1}
                </legend>

                {/* Fecha */}
                <div>
                  <label htmlFor={dateId} className="block text-sm font-medium mb-1">
                    Fecha (opción {idx + 1})
                  </label>
                  <input
                    id={dateId}
                    name={dateId}
                    type="date"
                    value={row.date}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, date: v } : r)));
                    }}
                    className="w-full border rounded px-3 py-2"
                    placeholder="YYYY-MM-DD"
                    title="Selecciona una fecha"
                    aria-describedby={`${dateId}-hint`}
                  />
                  <p id={`${dateId}-hint`} className="text-xs text-gray-500 mt-1">
                    Formato: AAAA-MM-DD
                  </p>
                </div>

                {/* Hora */}
                <div>
                  <label htmlFor={timeId} className="block text-sm font-medium mb-1">
                    Hora inicio (opción {idx + 1})
                  </label>
                  <input
                    id={timeId}
                    name={timeId}
                    type="time"
                    value={row.time}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, time: v } : r)));
                    }}
                    className="w-full border rounded px-3 py-2"
                    placeholder="HH:MM"
                    title="Selecciona una hora de inicio"
                    aria-describedby={`${timeId}-hint`}
                  />
                  <p id={`${timeId}-hint`} className="text-xs text-gray-500 mt-1">
                    Formato de 24h: HH:MM
                  </p>
                </div>

                {/* Columna vacía para mantener la rejilla alineada */}
                <div className="hidden sm:block" />
              </fieldset>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={!canSubmit || loading}
          >
            {loading ? 'Enviando...' : 'Proponer'}
          </button>
        </div>
      </div>
    </div>
  );
}
