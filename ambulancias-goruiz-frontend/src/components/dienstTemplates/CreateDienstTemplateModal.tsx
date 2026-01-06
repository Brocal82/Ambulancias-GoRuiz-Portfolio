import { useState } from "react";
import type { DienstTemplate } from "../../types/dienst";
import {
  createDienstTemplate,
  type DienstTemplateInput,
} from "../../api/dienstTemplates";
import CancelButton from "../common/actions/CancelButton";
import SaveIconButton from "../common/actions/SaveIconButton";

import {
  buildDefaultPerDayRows,
  areAllDaysOff,
  buildDienstTemplateInputFromRows,
  type DayScheduleFormRow,
} from "../../utils/dienstTemplates/templateSchedule";
import DienstTemplateScheduleGrid from "./DienstTemplateScheduleGrid";


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
  const [dienstNumber, setDienstNumber] = useState<number | "">("");
  // Horario global ya no se muestra, pero lo seguimos usando de fallback para el backend
  const [startTime, setStartTime] = useState<string>("06:00");
  const [endTime, setEndTime] = useState<string>("14:00");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🗓️ Estado local para el horario por día
  const [perDaySchedule, setPerDaySchedule] = useState<DayScheduleFormRow[]>(
    () => buildDefaultPerDayRows("06:00", "14:00"),
  );

  const allDaysOff = areAllDaysOff(perDaySchedule);

  const canSave = dienstNumber !== "" && Number(dienstNumber) > 0 && !allDaysOff;

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

    const allDaysOffLocal = areAllDaysOff(perDaySchedule);
    if (allDaysOffLocal) {
      setError("No tiene sentido que todos los días sean libres.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: DienstTemplateInput = buildDienstTemplateInputFromRows({
        dienstNumber: Number(dienstNumber),
        isActive,
        rows: perDaySchedule,
        startFallback: startTime,
        endFallback: endTime,
      });


      const created = await createDienstTemplate(payload, token);

      onCreated(created);

      // Reseteamos el formulario
      setDienstNumber("");
      setStartTime("06:00");
      setEndTime("14:00");
      setIsActive(true);
      setPerDaySchedule(buildDefaultPerDayRows("06:00", "14:00"));

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
          <DienstTemplateScheduleGrid
            variant="create"
            dienstNumber={dienstNumber}
            onDienstNumberChange={setDienstNumber}
            isActive={isActive}
            onIsActiveChange={setIsActive}
            rows={perDaySchedule}
            onToggleDayOff={handleToggleDayOff}
            onChangeDayStartTime={handleChangeDayStartTime}
            onChangeDayEndTime={handleChangeDayEndTime}
            dienstNumberInputId="createDienstNumber"
            isActiveCheckboxId="createIsActive"
          />


          {/* Botones */}
          <div className="mt-2 flex items-center justify-end gap-2 pt-3">
            <CancelButton onClick={onClose} disabled={saving} />

            <SaveIconButton type="submit" disabled={saving || !canSave} />
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDienstTemplateModal;
