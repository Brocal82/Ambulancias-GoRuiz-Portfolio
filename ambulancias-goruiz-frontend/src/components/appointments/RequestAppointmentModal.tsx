// frontend/src/components/appointments/RequestAppointmentModal.tsx
import { useState } from 'react';
import { requestAppointment } from '../../api/appointments';
import { useAuth } from '../../hooks/useAuth';
import { toastT } from "../../utils/toast";
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
      toastT.warn(["toasts.appointments.requestFill"]);
      return;
    }
    try {
      setLoading(true);
      await requestAppointment({ reason: reason.trim(), details: details.trim() }, token!);
      toastT.success(["toasts.appointments.requestSuccess"]);
      onClose();
      onSuccess?.();
    } catch (e: any) {
      toastT.error(e?.response?.data?.message ?? ["toasts.appointments.requestError"]);
    } finally {
      setLoading(false);
    }
  };

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {t('pages.appointments.request.title')}
        </h2>
      </div>

      {/* Formulario */}
      <div className="px-6 py-4 space-y-4">
        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('pages.appointments.request.labels.reason')}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder={t('pages.appointments.request.placeholders.reasonExample')}
            maxLength={120}
          />
          <p className="mt-1 text-xs text-slate-500">{reason.length}/120</p>
        </div>

        {/* Detalles */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('pages.appointments.request.labels.details')}
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-28 resize-y shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder={t('pages.appointments.request.placeholders.detailsHint')}
            maxLength={5000}
          />
          <p className="mt-1 text-xs text-slate-500">{details.length}/5000</p>
        </div>

        {/* Nota: futura preferencia de franja horaria */}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          disabled={loading}
        >
          {t('pages.appointments.request.actions.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
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
