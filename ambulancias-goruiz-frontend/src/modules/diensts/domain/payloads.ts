// frontend/src/modules/diensts/domain/payloads.ts
// FASE 1: compat -> aliases para nombres usados por algunos módulos/exports.
// NO cambia comportamiento, solo tipado.

import type { UpdateAssignment } from "../../../types/dienst";

// En tu app, updateDienstPartial usa este shape: { assignments: UpdateAssignment[] }
export type UpdateDienstPayload = {
  assignments: UpdateAssignment[];
};

// Alias por compat con nombre viejo
export type UpdateAssignmentPayload = UpdateAssignment;



