import React, { useEffect, useMemo, useState } from 'react';
import type { Appointment } from '../../types/appointment';
import { useAuth } from '../../hooks/useAuth';
import { cancelAppointment, updateAppointment } from '../../api/appointments';
import { toast } from 'react-toastify';
import { APP_TZ } from '../../config/app';
import { partsFromISO, localDateTimeToUtcISO } from '../../utils/tz';

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

  const handleCancel = async () => {
    if (!item?._id) return;
    const ok = window.confirm('¿Seguro que quieres cancelar esta cita?');
    if (!ok) return;
    try {
      setLoading(true);
      await cancelAppointment(item._id, token!);
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
      await updateAppointment(item._id, { selectedSlot: { start: conv.startISO, end: conv.endISO } }, token!);
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
          <h3 id="appt-detail-title" className="text-lg font-semibold">Detalle de cita</h3>

          {!isCancelled && !editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              title="Reprogramar"
            >
              Reprogramar
            </button>
          ) : null}

          {editMode && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={loading || saveDisabled}
                title="Guardar nueva fecha/hora"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Datos fijos */}
          <div><span className="text-gray-500 text-sm">Trabajador:</span> <span className="font-medium">{worker}</span></div>
          <div><span className="text-gray-500 text-sm">Admin:</span> <span className="font-medium">{admin}</span></div>
          <div><span className="text-gray-500 text-sm">Fecha/Hora actual:</span> <span className="font-medium">{when}</span></div>
          <div><span className="text-gray-500 text-sm">Estado:</span> <span className="font-medium capitalize">{item.status}</span></div>

          {/* Motivo / Descripción (solo lectura) */}
          <div className="pt-2">
            <div className="text-sm text-gray-500">Motivo</div>
            <div className="font-medium">{item.reason}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Descripción</div>
            <div className="whitespace-pre-wrap">{item.details}</div>
          </div>

          {/* Reprogramar (solo si no está cancelada) */}
          {!isCancelled && (
            <div className="pt-2">
              <div className="text-sm text-gray-500 mb-1">Reprogramar</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="re-date" className="block text-sm font-medium mb-1">Nueva fecha</label>
                  <input
                    id="re-date"
                    type="date"
                    value={reDate}
                    onChange={(e) => setReDate(e.target.value)}
                    disabled={!editMode || loading}
                    className="w-full border rounded px-3 py-2"
                    placeholder="YYYY-MM-DD"
                    title="Selecciona una fecha"
                  />
                </div>
                <div>
                  <label htmlFor="re-time" className="block text-sm font-medium mb-1">Nueva hora</label>
                  <input
                    id="re-time"
                    type="time"
                    value={reTime}
                    onChange={(e) => setReTime(e.target.value)}
                    disabled={!editMode || loading}
                    className="w-full border rounded px-3 py-2"
                    placeholder="HH:MM"
                    title="Selecciona una hora"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
              

        <div className="px-6 py-4 border-t flex justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-50" disabled={loading}>
            Cerrar
          </button>
          {!isCancelled && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              disabled={loading}
              title="Cancelar esta cita"
            >
              {loading ? 'Cancelando...' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAppointmentDetail;
