// frontend/src/components/appointments/RequestAppointmentModal.tsx
import { useState } from 'react';
import { requestAppointment } from '../../api/appointments';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // recargar lista tras crear
}

export default function RequestAppointmentModal({ isOpen, onClose, onSuccess }: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const canSubmit = reason.trim().length >= 3 && details.trim().length >= 5;

  const handleSubmit = async () => {
    if (!canSubmit) {
      // toasts quedan para la fase de toasts
      toast.warn('Completa motivo (≥3) y detalles (≥5).');
      return;
    }
    try {
      setLoading(true);
      await requestAppointment({ reason: reason.trim(), details: details.trim() }, token!);
      toast.success('Solicitud enviada.');
      onClose();
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{t('pages.appointments.request.title')}</h2>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('pages.appointments.request.labels.reason')}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded px-3 py-2 outline-none focus:ring"
              placeholder={t('pages.appointments.request.placeholders.reasonExample')}
              maxLength={120}
            />
            <p className="text-xs text-gray-500 mt-1">{reason.length}/120</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('pages.appointments.request.labels.details')}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full border rounded px-3 py-2 h-28 resize-y outline-none focus:ring"
              placeholder={t('pages.appointments.request.placeholders.detailsHint')}
              maxLength={5000}
            />
            <p className="text-xs text-gray-500 mt-1">{details.length}/5000</p>
          </div>

          {/* Nota: se puede añadir preferencia de franja horaria en un paso posterior */}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border hover:bg-gray-50"
            disabled={loading}
          >
            {t('pages.appointments.request.actions.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={!canSubmit || loading}
          >
            {loading
              ? t('pages.appointments.request.actions.submitting')
              : t('pages.appointments.request.actions.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
