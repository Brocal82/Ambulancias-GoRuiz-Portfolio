import React, { useEffect, useState } from "react";
import type { DienstTemplate } from "../../types/dienst";
import {
  updateDienstTemplate,
  type DienstTemplateInput,
} from "../../api/dienstTemplates";

interface Props {
  isOpen: boolean;
  template: DienstTemplate;
  token: string;
  onClose: () => void;
  onSaved: (updated: DienstTemplate) => void;
}

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden visual: Lunes (1) → Sábado (6) → Domingo (0)
const orderedDayIndices = [1, 2, 3, 4, 5, 6, 0];

interface DayScheduleFormRow {
  dayIndex: number;
  isOff: boolean;
  startTime: string;
  endTime: string;
}

const buildInitialPerDaySchedule = (
  tpl: DienstTemplate,
): DayScheduleFormRow[] => {
  const baseStart = tpl.startTime || "06:00";
  const baseEnd = tpl.endTime || "14:00";
  const daysOffSet = new Set<number>(tpl.daysOff ?? []);

  if (tpl.perDaySchedule && tpl.perDaySchedule.length > 0) {
    return dayLabels.map((_, dayIndex) => {
      const cfg = tpl.perDaySchedule!.find((d) => d.dayIndex === dayIndex);

      if (cfg) {
        return {
          dayIndex,
          isOff: !!cfg.isOff,
          startTime: cfg.startTime || baseStart,
          endTime: cfg.endTime || baseEnd,
        };
      }

      return {
        dayIndex,
        isOff: daysOffSet.has(dayIndex),
        startTime: baseStart,
        endTime: baseEnd,
      };
    });
  }

  return dayLabels.map((_, dayIndex) => ({
    dayIndex,
    isOff: daysOffSet.has(dayIndex),
    startTime: baseStart,
    endTime: baseEnd,
  }));
};

const EditDienstTemplateModal: React.FC<Props> = ({
  isOpen,
  template,
  token,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [editDienstNumber, setEditDienstNumber] = useState<number | "">(
    template.dienstNumber,
  );
  const [editStartTime, setEditStartTime] = useState<string>(
    template.startTime,
  );
  const [editEndTime, setEditEndTime] = useState<string>(template.endTime);
  const [editIsActive, setEditIsActive] = useState<boolean>(
    template.isActive ?? true,
  );
  const [perDayScheduleRows, setPerDayScheduleRows] = useState<
    DayScheduleFormRow[]
  >(() => buildInitialPerDaySchedule(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditDienstNumber(template.dienstNumber);
    setEditStartTime(template.startTime);
    setEditEndTime(template.endTime);
    setEditIsActive(template.isActive ?? true);
    setPerDayScheduleRows(buildInitialPerDaySchedule(template));
    setError(null);
    setSaving(false);
  }, [template]);

  const handleToggleDayOff = (dayIndex: number, isOff: boolean) => {
    setPerDayScheduleRows((prev) =>
      prev.map((day) => (day.dayIndex === dayIndex ? { ...day, isOff } : day)),
    );
  };

  const handleChangeDayStartTime = (dayIndex: number, value: string) => {
    setPerDayScheduleRows((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, startTime: value } : day,
      ),
    );
  };

  const handleChangeDayEndTime = (dayIndex: number, value: string) => {
    setPerDayScheduleRows((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, endTime: value } : day,
      ),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editDienstNumber === "" || editDienstNumber <= 0) {
      setError("Debes indicar un número de Dienst válido.");
      return;
    }

    const allDaysOff = perDayScheduleRows.every((d) => d.isOff);
    if (allDaysOff) {
      setError("No tiene sentido que todos los días sean libres.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const daysOff = perDayScheduleRows
        .filter((d) => d.isOff)
        .map((d) => d.dayIndex);

      // 🧮 Global start/end a partir de los días que trabajan
      const workingDays = perDayScheduleRows.filter((d) => !d.isOff);
      const globalStart = workingDays[0]?.startTime || editStartTime || "06:00";
      const globalEnd = workingDays[0]?.endTime || editEndTime || "14:00";

      const perDayScheduleForApi = perDayScheduleRows.map((d) => ({
        dayIndex: d.dayIndex,
        isOff: d.isOff,
        startTime: d.startTime,
        endTime: d.endTime,
      }));

      const payload: DienstTemplateInput = {
        dienstNumber: Number(editDienstNumber),
        startTime: globalStart,
        endTime: globalEnd,
        daysOff,
        isActive: editIsActive,
        perDaySchedule: perDayScheduleForApi,
      };

      const updated = await updateDienstTemplate(template._id, payload, token);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      console.error("Error al actualizar plantilla de Dienst:", err);
      const msg =
        err?.response?.data?.message ||
        "Error al actualizar la plantilla de Dienst";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-h-[90vh] w-full max-w-5xl rounded-xl bg-white p-4 shadow-lg flex flex-col">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Editar plantilla de Dienst #{template.dienstNumber}
        </h2>

        {error && (
          <div className="mb-2 rounded-md bg-red-100 px-3 py-1.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
        >
          {/* Grid tipo calendario: Nº Dienst + días */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-gray-600">
                Ajusta el número de Dienst y el horario por día. Los días libres
                se muestran en verde con la palmera 🌴.
              </p>
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 sm:inline">
                Semana de lunes a domingo
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
              {/* Columna: Nº Dienst */}
              <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-gray-800">
                    Nº Dienst
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label htmlFor="editDienstNumber" className="sr-only">
                      Número de Dienst
                    </label>
                    <input
                      id="editDienstNumber"
                      type="number"
                      min={1}
                      value={editDienstNumber}
                      onChange={(e) =>
                        setEditDienstNumber(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="editIsActive"
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="editIsActive"
                      className="text-[11px] font-medium text-gray-700"
                    >
                      Plantilla activa
                    </label>
                  </div>
                </div>
              </div>

              {/* Columnas: Lunes → Domingo */}
              {orderedDayIndices.map((index) => {
                const day = perDayScheduleRows.find(
                  (d) => d.dayIndex === index,
                );
                if (!day) return null;

                const isOff = day.isOff;

                return (
                  <div
                    key={day.dayIndex}
                    className={`flex h-full flex-col rounded-xl border p-2 text-xs shadow-sm transition-colors ${
                      isOff
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Cabecera día + icono toggle */}
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-gray-800">
                        {dayLabels[day.dayIndex]}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleDayOff(day.dayIndex, !isOff)}
                        className="rounded-full p-1 text-[13px] hover:bg-black/5"
                        aria-label={
                          isOff
                            ? `Editar día ${dayLabels[day.dayIndex]}`
                            : `Marcar ${dayLabels[day.dayIndex]} como libre`
                        }
                      >
                        {isOff ? "⚙️" : "🌴"}
                      </button>
                    </div>

                    {/* Contenido: horas o libre */}
                    {isOff ? (
                      <div className="flex flex-1 items-center justify-center text-[11px] font-medium text-emerald-800">
                        <span className="flex items-center gap-1">
                          🌴 Libre
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div>
                          <label
                            htmlFor={`edit-startTime-${day.dayIndex}`}
                            className="sr-only"
                          >
                            {`Hora de inicio (${dayLabels[day.dayIndex]})`}
                          </label>
                          <input
                            id={`edit-startTime-${day.dayIndex}`}
                            type="time"
                            value={day.startTime}
                            onChange={(e) =>
                              handleChangeDayStartTime(
                                day.dayIndex,
                                e.target.value,
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-endTime-${day.dayIndex}`}
                            className="sr-only"
                          >
                            {`Hora de fin (${dayLabels[day.dayIndex]})`}
                          </label>
                          <input
                            id={`edit-endTime-${day.dayIndex}`}
                            type="time"
                            value={day.endTime}
                            onChange={(e) =>
                              handleChangeDayEndTime(
                                day.dayIndex,
                                e.target.value,
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botones */}
          <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDienstTemplateModal;
