import React, { useEffect, useState } from "react";

import type { DienstTemplate } from "../../diensts";

import {
  updateDienstTemplate,
  type DienstTemplateInput,
} from "../../../api/dienstTemplates";

import CancelButton from "../../../components/common/actions/CancelButton";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";

import {
  buildInitialPerDaySchedule,
  areAllDaysOff,
  buildDienstTemplateInputFromRows,
  type DayScheduleFormRow,
} from "../utils/templateSchedule";

import DienstTemplateScheduleGrid from "./DienstTemplateScheduleGrid";


interface Props {
  isOpen: boolean;
  template: DienstTemplate;
  token: string;
  onClose: () => void;
  onSaved: (updated: DienstTemplate) => void;
}

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
  const [editStartTime, setEditStartTime] = useState<string>(template.startTime);
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

  const allDaysOff = areAllDaysOff(perDayScheduleRows);

  const isValid =
    editDienstNumber !== "" && Number(editDienstNumber) > 0 && !allDaysOff;

  // ⬇️ detectamos si el usuario ha cambiado algo (MISMA lógica que antes)
  const initialRows = buildInitialPerDaySchedule(template);

  const isDirty =
    Number(editDienstNumber) !== Number(template.dienstNumber) ||
    editIsActive !== (template.isActive ?? true) ||
    JSON.stringify(perDayScheduleRows) !== JSON.stringify(initialRows);

  const canSave = isValid && isDirty;

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

    const allDaysOffLocal = areAllDaysOff(perDayScheduleRows);
    if (allDaysOffLocal) {
      setError("No tiene sentido que todos los días sean libres.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: DienstTemplateInput = buildDienstTemplateInputFromRows({
        dienstNumber: Number(editDienstNumber),
        isActive: editIsActive,
        rows: perDayScheduleRows,
        startFallback: editStartTime,
        endFallback: editEndTime,
      });


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
          <DienstTemplateScheduleGrid
            variant="edit"
            dienstNumber={editDienstNumber}
            onDienstNumberChange={setEditDienstNumber}
            isActive={editIsActive}
            onIsActiveChange={setEditIsActive}
            rows={perDayScheduleRows}
            onToggleDayOff={handleToggleDayOff}
            onChangeDayStartTime={handleChangeDayStartTime}
            onChangeDayEndTime={handleChangeDayEndTime}
            dienstNumberInputId="editDienstNumber"
            isActiveCheckboxId="editIsActive"
          />


          {/* Botones */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <CancelButton onClick={onClose} disabled={saving}>
              Cancelar
            </CancelButton>

            <SaveIconButton
              type="submit"
              disabled={saving || !canSave}
              title={saving ? "Guardando..." : "Guardar cambios"}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDienstTemplateModal;
