import { useEffect, useMemo, useState } from 'react';
import { proposeSlots } from '../../api/appointments';
import { useAuth } from '../../hooks/useAuth';
import { toastT } from "../../utils/toast";
import { APP_TZ } from '../../config/app';
import { localDateTimeToUtcISO } from '../../utils/tz';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
      // Dejamos toasts y errores para la fase de toasts, no internacionalizamos mensajes de error aquí.
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
      toastT.success(["toasts.appointments.proposeSuccess"]);
      onClose();
      onSuccess?.();
    } catch (e: any) {
       toastT.error(e?.response?.data?.message ?? e?.message ?? ["toasts.appointments.proposeError"]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="propose-title"
      >
        <div className="px-6 py-4 border-b">
          <h2 id="propose-title" className="text-lg font-semibold">
            {t('pages.appointments.propose.title')}
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {rows.map((row, idx) => {
            const dateId = `slot-date-${idx}`;
            const timeId = `slot-time-${idx}`;

            return (
              <fieldset
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                aria-labelledby={`slot-legend-${idx}`}
              >
                <legend id={`slot-legend-${idx}`} className="sr-only">
                  {t('pages.appointments.propose.optionLegend', { index: idx + 1 })}
                </legend>

                {/* Fecha */}
                <div>
                  <label htmlFor={dateId} className="block text-sm font-medium mb-1">
                    {t('pages.appointments.propose.dateLabel', { index: idx + 1 })}
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
                    placeholder={t('pages.appointments.propose.datePlaceholder')}
                    title={t('pages.appointments.propose.dateTitle')}
                    aria-describedby={`${dateId}-hint`}
                  />
                  <p id={`${dateId}-hint`} className="text-xs text-gray-500 mt-1">
                    {t('pages.appointments.propose.dateHint')}
                  </p>
                </div>

                {/* Hora */}
                <div>
                  <label htmlFor={timeId} className="block text-sm font-medium mb-1">
                    {t('pages.appointments.propose.timeLabel', { index: idx + 1 })}
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
                    placeholder={t('pages.appointments.propose.timePlaceholder')}
                    title={t('pages.appointments.propose.timeTitle')}
                    aria-describedby={`${timeId}-hint`}
                  />
                  <p id={`${timeId}-hint`} className="text-xs text-gray-500 mt-1">
                    {t('pages.appointments.propose.timeHint')}
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
            {t('pages.appointments.propose.actions.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={!canSubmit || loading}
          >
            {loading
              ? t('pages.appointments.propose.actions.submitting')
              : t('pages.appointments.propose.actions.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
