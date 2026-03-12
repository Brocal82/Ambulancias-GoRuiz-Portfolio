import type { VacFlag } from "../../../../modules/vacation/domain/api";
import type { SickFlag } from "../../../../api/sickLeaves";

export const validateAssignmentSave = (params: {
  dienstId: string;
  startTime: string;
  endTime: string;
  selectedDriverId: string;
  selectedMedicId: string;
  sickFlags: Record<string, SickFlag>;
  vacationFlags: Record<string, VacFlag>;
}): { type: "error" | "warn"; key: string } | null => {
  const {
    dienstId,
    startTime,
    endTime,
    selectedDriverId,
    selectedMedicId,
    sickFlags,
    vacationFlags,
  } = params;

  if (!dienstId) {
    return { type: "error", key: "toasts.assignments.missingDienstId" };
  }

  if (!startTime || !endTime) {
    return { type: "warn", key: "toasts.assignments.missingFields" };
  }

  if (selectedDriverId && selectedMedicId && selectedDriverId === selectedMedicId) {
    return { type: "warn", key: "toasts.assignments.samePerson" };
  }

  if (selectedDriverId && sickFlags[selectedDriverId]?.hasSickInRange) {
    return { type: "warn", key: "toasts.assignments.userSickDriver" };
  }

  if (selectedMedicId && sickFlags[selectedMedicId]?.hasSickInRange) {
    return { type: "warn", key: "toasts.assignments.userSickMedic" };
  }

  if (selectedDriverId && vacationFlags[selectedDriverId]?.hasVacationInRange) {
    return { type: "warn", key: "toasts.assignments.userOnVacationDriver" };
  }

  if (selectedMedicId && vacationFlags[selectedMedicId]?.hasVacationInRange) {
    return { type: "warn", key: "toasts.assignments.userOnVacationMedic" };
  }

  return null;
};

