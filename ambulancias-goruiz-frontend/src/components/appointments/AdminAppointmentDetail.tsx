import React, { useEffect, useMemo, useState } from 'react';
import type { Appointment } from '../../types/appointment';
import { useAuth } from '../../hooks/useAuth';
import { cancelAppointment, updateAppointment } from '../../api/appointments';
import { toast } from 'react-toastify';
import { APP_TZ } from '../../config/app';
import { partsFromISO, localDateTimeToUtcISO } from '../../utils/tz';
import { useTranslation } from 'react-i18next';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: Appointment | null;
  /** Llamar tras cambios (cancelar/reprogramar) para refrescar en el padre */
  onChanged?: () => void;
};

const DEFAULT_DURATION_MIN = 30; // duración fija por defecto

const AdminAppointmentDetail: React.FC<Props> = ({ isOpen, onClose, item, onChanged }) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [reDate, setReDate] = useState(''); // YYYY-MM-DD
  const [reTime, setReTime] = useState(''); // HH:mm

  useEffect(() => {
    if (!isOpen || !item) return;
    setEditMode(false);
    const { date, time } = partsFromISO(item.selectedSlot?.start, APP_TZ);
    setReDate(date);
    setReTime(time);
  }, [isOpen, item]);

  const saveDisabled = useMemo(() => {
    if (!editMode) return true;
    if (!reDate || !reTime) return true;
    return false;
  }, [editMode, reDate, reTime]);

  if (!isOpen || !item) return null;

  const isCancelled = item.status === 'cancelled';

  const worker =
    typeof item.workerId === 'object'
      ? `${item.workerId.lastName}, ${item.workerId.name}`
      : String(item.workerId);

  const admin =
    item.adminId && typeof item.adminId === 'object'
      ? `${(item.adminId as any).lastName}, ${(item.adminId as any).name}`
      : item.adminId
      ? String(item.adminId)
      : '—';

  const when =
    item.selectedSlot?.start
      ? new Date(item.selectedSlot.start).toLocaleString('de-DE', { timeZone: APP_TZ })
      : '—';

  const statusLabel = t(`pages.appointments.statusLabel.${item.status}`);

  const handleCancel = async () => {
    if (!item?._id) return;
    const ok = window.confirm(t('pages.appointments.detail.confirmCancel'));
    if (!ok) return;
    try {
      setLoading(true);
      await cancelAppointment(item._id, token!);
      // toasts: fase aparte
      toast.success('Cita cancelada.');
      onClose();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al cancelar la cita.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!item?._id) return;

    // Reprogramación usando duración por defecto
    const conv = localDateTimeToUtcISO(APP_TZ, reDate, reTime, DEFAULT_DURATION_MIN);
    if (!conv) {
      toast.warn('Fecha/hora inválidas.');
      return;
    }
    if (conv.start.getTime() <= Date.now()) {
      toast.warn('No se puede programar en el pasado.');
      return;
    }

    try {
      setLoading(true);
      await updateAppointment(
        item._id,
        { selectedSlot: { start: conv.startISO, end: conv.endISO } },
        token!
      );
      toast.success('Cita reprogramada.');
      setEditMode(false);
      onClose();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al reprogramar la cita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg" role="dialog" aria-modal="true" aria-labelledby="appt-detail-title">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 id="appt-detail-title" className="text-lg font-semibold">
            {t('pages.appointments.detail.title')}
          </h3>

          {!isCancelled && !editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              title={t('pages.appointments.detail.rebookTitle')}
            >
              {t('pages.appointments.detail.rebook')}
            </button>
          ) : null}

          {editMode && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                disabled={loading}
              >
                {t('pages.appointments.detail.actions.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={loading || saveDisabled}
                title={t('pages.appointments.detail.saveNewDatetime')}
              >
                {loading ? t('pages.appointments.detail.actions.saving') : t('pages.appointments.detail.actions.save')}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Datos fijos */}
          <div>
            <span className="text-gray-500 text-sm">{t('pages.appointments.detail.labels.worker')}</span>{' '}
            <span className="font-medium">{worker}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm">{t('pages.appointments.detail.labels.admin')}</span>{' '}
            <span className="font-medium">{admin}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm">{t('pages.appointments.detail.labels.currentWhen')}</span>{' '}
            <span className="font-medium">{when}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm">{t('pages.appointments.detail.labels.status')}</span>{' '}
            <span className="font-medium capitalize">{statusLabel}</span>
          </div>

          {/* Motivo / Descripción (solo lectura) */}
          <div className="pt-2">
            <div className="text-sm text-gray-500">{t('pages.appointments.detail.labels.reason')}</div>
            <div className="font-medium">{item.reason}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('pages.appointments.detail.labels.description')}</div>
            <div className="whitespace-pre-wrap">{item.details}</div>
          </div>

          {/* Reprogramar (solo si no está cancelada) */}
          {!isCancelled && (
            <div className="pt-2">
              <div className="text-sm text-gray-500 mb-1">{t('pages.appointments.detail.rebook')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="re-date" className="block text-sm font-medium mb-1">
                    {t('pages.appointments.detail.inputs.newDate')}
                  </label>
                  <input
                    id="re-date"
                    type="date"
                    value={reDate}
                    onChange={(e) => setReDate(e.target.value)}
                    disabled={!editMode || loading}
                    className="w-full border rounded px-3 py-2"
                    placeholder={t('pages.appointments.detail.placeholders.date')}
                    title={t('pages.appointments.detail.titles.date')}
                  />
                </div>
                <div>
                  <label htmlFor="re-time" className="block text-sm font-medium mb-1">
                    {t('pages.appointments.detail.inputs.newTime')}
                  </label>
                  <input
                    id="re-time"
                    type="time"
                    value={reTime}
                    onChange={(e) => setReTime(e.target.value)}
                    disabled={!editMode || loading}
                    className="w-full border rounded px-3 py-2"
                    placeholder={t('pages.appointments.detail.placeholders.time')}
                    title={t('pages.appointments.detail.titles.time')}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-50" disabled={loading}>
            {t('pages.appointments.detail.actions.close')}
          </button>
          {!isCancelled && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              disabled={loading}
              title={t('pages.appointments.detail.cancelThisTitle')}
            >
              {loading ? t('pages.appointments.detail.actions.cancelling') : t('pages.appointments.detail.actions.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAppointmentDetail;
