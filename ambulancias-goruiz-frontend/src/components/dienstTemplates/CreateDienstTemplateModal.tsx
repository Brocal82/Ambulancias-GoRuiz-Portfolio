// frontend/src/components/dienstTemplates/CreateDienstTemplateModal.tsx
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

interface DayScheduleFormRow {
  dayIndex: number;
  isOff: boolean;
  startTime: string;
  endTime: string;
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
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🗓️ Estado local para el horario por día
  const [perDaySchedule, setPerDaySchedule] = useState<DayScheduleFormRow[]>(() =>
    dayLabels.map((_, index) => ({
      dayIndex: index,
      isOff: false,
      startTime: '06:00',
      endTime: '14:00',
    }))
  );

  if (!isOpen) return null;

  const handleToggleDayOff = (dayIndex: number, checked: boolean) => {
    setPerDaySchedule((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, isOff: checked } : day
      )
    );
  };

  const handleChangeDayStartTime = (dayIndex: number, value: string) => {
    setPerDaySchedule((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, startTime: value } : day
      )
    );
  };

  const handleChangeDayEndTime = (dayIndex: number, value: string) => {
    setPerDaySchedule((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, endTime: value } : day
      )
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
      setError('Debes indicar un horario global de inicio y fin.');
      return;
    }

    const allDaysOff = perDaySchedule.every((d) => d.isOff);
    if (allDaysOff) {
      setError('No tiene sentido que todos los días sean libres.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 🧮 daysOff se calcula a partir de los días con isOff = true
      const daysOff = perDaySchedule
        .filter((d) => d.isOff)
        .map((d) => d.dayIndex);

      // 🧱 Construimos perDaySchedule para la API
      const perDayScheduleForApi = perDaySchedule.map((d) => ({
        dayIndex: d.dayIndex,
        isOff: d.isOff,
        startTime: d.startTime,
        endTime: d.endTime,
      }));

      const payload: DienstTemplateInput = {
        dienstNumber: Number(dienstNumber),
        startTime,
        endTime,
        daysOff,
        isActive,
        perDaySchedule: perDayScheduleForApi,
      };

      const created = await createDienstTemplate(payload, token);

      onCreated(created);

      // Reseteamos el formulario
      setDienstNumber('');
      setStartTime('06:00');
      setEndTime('14:00');
      setIsActive(true);
      setPerDaySchedule(
        dayLabels.map((_, index) => ({
          dayIndex: index,
          isOff: false,
          startTime: '06:00',
          endTime: '14:00',
        }))
      );

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
      <div className="max-h-[90vh] w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg flex flex-col">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Crear nueva plantilla de Dienst
        </h2>

        {error && (
          <div className="mb-3 rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Contenido scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
        >
          {/* Nº Dienst + horario global */}
          <div className="grid gap-4 md:grid-cols-[1.2fr,1.8fr]">
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
                  Hora inicio global
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
                  Hora fin global
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

          {/* 🗓️ Horario por día en tarjetas (2 columnas en desktop) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Horario por día de la semana
            </label>

            <div className="max-h-[50vh] overflow-y-auto rounded-md border border-gray-200 p-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {perDaySchedule.map((day) => (
                  <div
                    key={day.dayIndex}
                    className="flex flex-col gap-2 rounded-md border border-gray-200 p-2 text-xs"
                  >
                    {/* Cabecera: día + checkbox libre */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">
                        {dayLabels[day.dayIndex]}
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          id={`isOff-${day.dayIndex}`}
                          type="checkbox"
                          checked={day.isOff}
                          onChange={(e) =>
                            handleToggleDayOff(day.dayIndex, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`isOff-${day.dayIndex}`}
                          className="text-[11px] text-gray-700"
                        >
                          Libre
                        </label>
                      </div>
                    </div>

                    {/* Horas inicio/fin */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor={`startTime-${day.dayIndex}`}
                          className="sr-only"
                        >
                          {`Hora de inicio (${dayLabels[day.dayIndex]})`}
                        </label>
                        <input
                          id={`startTime-${day.dayIndex}`}
                          type="time"
                          value={day.startTime}
                          onChange={(e) =>
                            handleChangeDayStartTime(
                              day.dayIndex,
                              e.target.value
                            )
                          }
                          disabled={day.isOff}
                          className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`endTime-${day.dayIndex}`}
                          className="sr-only"
                        >
                          {`Hora de fin (${dayLabels[day.dayIndex]})`}
                        </label>
                        <input
                          id={`endTime-${day.dayIndex}`}
                          type="time"
                          value={day.endTime}
                          onChange={(e) =>
                            handleChangeDayEndTime(
                              day.dayIndex,
                              e.target.value
                            )
                          }
                          disabled={day.isOff}
                          className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activa / inactiva */}
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

          {/* Botones */}
          <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-3">
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

