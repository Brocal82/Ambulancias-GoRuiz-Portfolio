import { useState } from "react";
import type { DienstTemplate } from "../../types/dienst";
import {
  createDienstTemplate,
  type DienstTemplateInput,
} from "../../api/dienstTemplates";

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden visual: Lunes (1) → Sábado (6) → Domingo (0)
const orderedDayIndices = [1, 2, 3, 4, 5, 6, 0];

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
  const [dienstNumber, setDienstNumber] = useState<number | "">("");
  // Horario global ya no se muestra, pero lo seguimos usando de fallback para el backend
  const [startTime, setStartTime] = useState<string>("06:00");
  const [endTime, setEndTime] = useState<string>("14:00");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🗓️ Estado local para el horario por día
  const [perDaySchedule, setPerDaySchedule] = useState<DayScheduleFormRow[]>(
    () =>
      dayLabels.map((_, index) => ({
        dayIndex: index,
        isOff: false,
        startTime: "06:00",
        endTime: "14:00",
      })),
  );

  if (!isOpen) return null;

  const handleToggleDayOff = (dayIndex: number, isOff: boolean) => {
    setPerDaySchedule((prev) =>
      prev.map((day) => (day.dayIndex === dayIndex ? { ...day, isOff } : day)),
    );
  };

  const handleChangeDayStartTime = (dayIndex: number, value: string) => {
    setPerDaySchedule((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, startTime: value } : day,
      ),
    );
  };

  const handleChangeDayEndTime = (dayIndex: number, value: string) => {
    setPerDaySchedule((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex ? { ...day, endTime: value } : day,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      setError("No hay token de autenticación. Inicia sesión de nuevo.");
      return;
    }

    if (dienstNumber === "" || dienstNumber <= 0) {
      setError("Debes indicar un número de Dienst válido.");
      return;
    }

    const allDaysOff = perDaySchedule.every((d) => d.isOff);
    if (allDaysOff) {
      setError("No tiene sentido que todos los días sean libres.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 🧮 daysOff a partir de días libres
      const daysOff = perDaySchedule
        .filter((d) => d.isOff)
        .map((d) => d.dayIndex);

      // 🧮 Definir horario global para compatibilidad backend
      const workingDays = perDaySchedule.filter((d) => !d.isOff);
      const globalStart = workingDays[0]?.startTime || startTime || "06:00";
      const globalEnd = workingDays[0]?.endTime || endTime || "14:00";

      // 🧱 perDaySchedule para la API
      const perDayScheduleForApi = perDaySchedule.map((d) => ({
        dayIndex: d.dayIndex,
        isOff: d.isOff,
        startTime: d.startTime,
        endTime: d.endTime,
      }));

      const payload: DienstTemplateInput = {
        dienstNumber: Number(dienstNumber),
        startTime: globalStart,
        endTime: globalEnd,
        daysOff,
        isActive,
        perDaySchedule: perDayScheduleForApi,
      };

      const created = await createDienstTemplate(payload, token);

      onCreated(created);

      // Reseteamos el formulario
      setDienstNumber("");
      setStartTime("06:00");
      setEndTime("14:00");
      setIsActive(true);
      setPerDaySchedule(
        dayLabels.map((_, index) => ({
          dayIndex: index,
          isOff: false,
          startTime: "06:00",
          endTime: "14:00",
        })),
      );

      onClose();
    } catch (err: any) {
      console.error("Error al crear plantilla de Dienst:", err);
      const msg =
        err?.response?.data?.message || "Error al crear la plantilla de Dienst";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-h-[90vh] w-full max-w-5xl rounded-xl bg-white p-4 shadow-lg flex flex-col">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Crear nueva plantilla de Dienst
        </h2>

        {error && (
          <div className="mb-3 rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
        >
          {/* 🧱 Grid tipo calendario: Nº Dienst + días de la semana */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-gray-600">
                Configura el número de Dienst y el horario por día. Los días
                libres se muestran en verde con la palmera 🌴.
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
                    <label htmlFor="createDienstNumber" className="sr-only">
                      Número de Dienst
                    </label>
                    <input
                      id="createDienstNumber"
                      type="number"
                      min={1}
                      value={dienstNumber}
                      onChange={(e) =>
                        setDienstNumber(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="createIsActive"
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="createIsActive"
                      className="text-[11px] font-medium text-gray-700"
                    >
                      Plantilla activa
                    </label>
                  </div>
                </div>
              </div>

              {/* Columnas: Lunes → Domingo */}
              {orderedDayIndices.map((index) => {
                const day = perDaySchedule.find((d) => d.dayIndex === index);
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
                                e.target.value,
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              {saving ? "Creando..." : "Crear plantilla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDienstTemplateModal;
