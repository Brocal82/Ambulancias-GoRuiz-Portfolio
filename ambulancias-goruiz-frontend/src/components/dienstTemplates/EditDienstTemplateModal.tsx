// frontend/src/components/dienstTemplates/EditDienstTemplateModal.tsx
import type { Dispatch, SetStateAction } from 'react';
import type { DienstTemplate } from '../../types/dienst';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface Props {
  template: DienstTemplate | null;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;

  editDienstNumber: number | '';
  setEditDienstNumber: (v: number | '') => void;

  editStartTime: string;
  setEditStartTime: (v: string) => void;

  editEndTime: string;
  setEditEndTime: (v: string) => void;

  editDaysOff: number[];
  // 👇 ahora acepta también función (prev => nuevoArray)
  setEditDaysOff: Dispatch<SetStateAction<number[]>>;

  editIsActive: boolean;
  setEditIsActive: (v: boolean) => void;
}

export default function EditDienstTemplateModal({
  template,
  onClose,
  onSave,
  saving,
  editDienstNumber,
  setEditDienstNumber,
  editStartTime,
  setEditStartTime,
  editEndTime,
  setEditEndTime,
  editDaysOff,
  setEditDaysOff,
  editIsActive,
  setEditIsActive,
}: Props) {
  if (!template) return null;

  const toggleEditDayOff = (dayIndex: number) => {
    setEditDaysOff((prev: number[]) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Editar plantilla #{template.dienstNumber}
        </h2>

        {/* Formulario */}
        <div className="space-y-4">
          {/* Nº Dienst */}
          <div>
            <label
              htmlFor="editDienstNumber"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Nº Dienst
            </label>
            <input
              id="editDienstNumber"
              type="number"
              min={1}
              value={editDienstNumber}
              onChange={(e) =>
                setEditDienstNumber(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="editStartTime"
                className="mb-1 block text-xs font-medium text-gray-700"
              >
                Hora inicio
              </label>
              <input
                id="editStartTime"
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="editEndTime"
                className="mb-1 block text-xs font-medium text-gray-700"
              >
                Hora fin
              </label>
              <input
                id="editEndTime"
                type="time"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>

          {/* Días libres */}
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-700">
              Días libres
            </span>
            <div className="flex flex-wrap gap-1">
              {dayLabels.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleEditDayOff(index)}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    editDaysOff.includes(index)
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Activa */}
          <label className="flex items-center gap-2 text-sm">
            <input
              id="editIsActive"
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
            />
            <span>Plantilla activa</span>
          </label>
        </div>

        {/* Botones */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
