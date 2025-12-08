import { useState } from 'react';
import type { DienstTemplate } from '../../types/dienst';
import {
  createDienstTemplate,
  type DienstTemplateInput,
} from '../../api/dienstTemplates';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface CreateDienstTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onCreated: (tpl: DienstTemplate) => void;
}

const CreateDienstTemplateModal: React.FC<CreateDienstTemplateModalProps> = ({
  isOpen,
  onClose,
  token,
  onCreated,
}) => {
  const [dienstNumber, setDienstNumber] = useState<number | ''>('');
  const [startTime, setStartTime] = useState<string>('06:00');
  const [endTime, setEndTime] = useState<string>('14:00');
  const [daysOff, setDaysOff] = useState<number[]>([]);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleDayOff = (dayIndex: number) => {
    setDaysOff((prev: number[]) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      setError('No hay token de autenticación. Inicia sesión de nuevo.');
      return;
    }

    if (dienstNumber === '' || dienstNumber <= 0) {
      setError('Debes indicar un número de Dienst válido.');
      return;
    }

    if (!startTime || !endTime) {
      setError('Debes indicar un horario de inicio y fin.');
      return;
    }

    if (daysOff.length === 7) {
      setError('No tiene sentido que todos los días sean libres.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: DienstTemplateInput = {
        dienstNumber: Number(dienstNumber),
        startTime,
        endTime,
        daysOff,
        isActive,
      };

      const created = await createDienstTemplate(payload, token);

      onCreated(created);

      // Reseteamos el formulario
      setDienstNumber('');
      setStartTime('06:00');
      setEndTime('14:00');
      setDaysOff([]);
      setIsActive(true);

      onClose();
    } catch (err: any) {
      console.error('Error al crear plantilla de Dienst:', err);
      const msg =
        err?.response?.data?.message ||
        'Error al crear la plantilla de Dienst';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Crear nueva plantilla de Dienst
        </h2>

        {error && (
          <div className="mb-3 rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="createDienstNumber"
                className="mb-1 block text-xs font-medium text-gray-700"
              >
                Nº Dienst
              </label>
              <input
                id="createDienstNumber"
                type="number"
                min={1}
                value={dienstNumber}
                onChange={(e) =>
                  setDienstNumber(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="createStartTime"
                  className="mb-1 block text-xs font-medium text-gray-700"
                >
                  Hora inicio
                </label>
                <input
                  id="createStartTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="createEndTime"
                  className="mb-1 block text-xs font-medium text-gray-700"
                >
                  Hora fin
                </label>
                <input
                  id="createEndTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Días libres
            </label>
            <div className="flex flex-wrap gap-1">
              {dayLabels.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleToggleDayOff(index)}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    daysOff.includes(index)
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="createIsActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="createIsActive"
              className="text-xs font-medium text-gray-700"
            >
              Plantilla activa
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? 'Creando...' : 'Crear plantilla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDienstTemplateModal;
