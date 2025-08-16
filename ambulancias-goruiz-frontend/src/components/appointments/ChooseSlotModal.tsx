// frontend/src/components/appointments/ChooseSlotModal.tsx
import { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { selectSlot } from '../../api/appointments';
import type { TimeSlot } from '../../types/appointment';
import { toast } from 'react-toastify';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  proposedSlots: TimeSlot[];
  onSuccess?: () => void; // refrescar lista tras confirmar
}

export default function ChooseSlotModal({
  isOpen,
  onClose,
  appointmentId,
  proposedSlots,
  onSuccess,
}: Props) {
  const { token } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const slotsBerlin = useMemo(() => {
    return (proposedSlots || []).map((s) => ({
      ...s,
      label: new Date(s.start).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
    }));
  }, [proposedSlots]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (selectedIndex === null) {
      toast.warn('Selecciona una opción.');
      return;
    }
    try {
      setLoading(true);
      const sel = proposedSlots[selectedIndex];
      await selectSlot(appointmentId, { selectedSlot: sel }, token!);
      toast.success('Cita confirmada.');
      onClose();
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al confirmar la cita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg" role="dialog" aria-modal="true" aria-labelledby="choose-title">
        <div className="px-6 py-4 border-b">
          <h2 id="choose-title" className="text-lg font-semibold">Elige un horario</h2>
          <p className="text-sm text-gray-600 mt-1">
            Horarios mostrados en <b>Europe/Berlin</b>.
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {slotsBerlin.length === 0 ? (
            <p className="text-sm text-gray-600">No hay opciones disponibles. Espera a que el administrador proponga horarios.</p>
          ) : (
            <ul className="space-y-2">
              {slotsBerlin.map((s, idx) => (
                <li key={idx}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="slot"
                      aria-label={`Opción ${idx + 1}: ${s.label}`}
                      checked={selectedIndex === idx}
                      onChange={() => setSelectedIndex(idx)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-50" disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            disabled={loading || selectedIndex === null || slotsBerlin.length === 0}
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
