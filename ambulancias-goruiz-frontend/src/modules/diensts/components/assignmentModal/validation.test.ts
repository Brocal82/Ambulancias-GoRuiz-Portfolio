import { describe, it, expect } from "vitest";
import { validateAssignmentSave } from "./validation";

describe("validateAssignmentSave", () => {
  const base = {
    dienstId: "507f1f77bcf86cd799439011",
    startTime: "08:00",
    endTime: "16:00",
    selectedDriverId: "",
    selectedMedicId: "",
    sickFlags: {},
    vacationFlags: {},
  };

  it("devuelve error si falta dienstId", () => {
    expect(
      validateAssignmentSave({ ...base, dienstId: "" }),
    ).toEqual({ type: "error", key: "toasts.assignments.missingDienstId" });
  });

  it("devuelve warn si faltan horarios", () => {
    expect(
      validateAssignmentSave({ ...base, startTime: "" }),
    ).toEqual({ type: "warn", key: "toasts.assignments.missingFields" });
  });

  it("devuelve warn si driver y medic son la misma persona", () => {
    const id = "507f1f77bcf86cd799439011";
    expect(
      validateAssignmentSave({
        ...base,
        selectedDriverId: id,
        selectedMedicId: id,
      }),
    ).toEqual({ type: "warn", key: "toasts.assignments.samePerson" });
  });

  it("devuelve null si la asignación es válida", () => {
    expect(validateAssignmentSave(base)).toBeNull();
  });

  it("devuelve warn si el driver tiene baja en el rango", () => {
    const driverId = "507f1f77bcf86cd799439011";
    expect(
      validateAssignmentSave({
        ...base,
        selectedDriverId: driverId,
        sickFlags: { [driverId]: { hasSickInRange: true } },
      }),
    ).toEqual({ type: "warn", key: "toasts.assignments.userSickDriver" });
  });

  it("devuelve warn si el medic tiene vacaciones en el rango", () => {
    const medicId = "507f1f77bcf86cd799439012";
    expect(
      validateAssignmentSave({
        ...base,
        selectedMedicId: medicId,
        vacationFlags: { [medicId]: { hasVacationInRange: true } },
      }),
    ).toEqual({ type: "warn", key: "toasts.assignments.userOnVacationMedic" });
  });
});
