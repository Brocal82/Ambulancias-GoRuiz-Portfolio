//src/modules/diensts/utils/dienstStatusStyles.ts
import { isPartialAssignment } from "./assignmentUtils";
export type AssignmentStatus = "off" | "partial" | "full";

/** Referencia única para estado incompleto/parcial (todas las vistas) */
export const INCOMPLETE_BG_RING = "bg-yellow-50 ring-yellow-300";
export const INCOMPLETE_BORDER = "border border-yellow-300";
export const INCOMPLETE_TEXT = "text-slate-900";

/**
 * Determina el estado visual de una celda.
 * - off: día libre (sin horas)
 * - partial: incompleto (amarillo)
 * - full: completo (azul)
 *
 * Importante: usamos la misma lógica que ya tenías (isPartialAssignment).
 */
export const getAssignmentStatus = (
  assignment: unknown,
): AssignmentStatus => {
  if (!assignment) return "off";
  return isPartialAssignment(assignment as any) ? "partial" : "full";
};

/**
 * Mapea status -> clases Tailwind.
 * partial usa la misma paleta amarilla en Admin, Worker y AdminUserDienstsTab.
 */
export const getStatusClass = (status: AssignmentStatus): string => {
  if (status === "partial") return INCOMPLETE_BG_RING;
  if (status === "full") return "bg-blue-100 ring-blue-300";
  return "bg-emerald-50 ring-emerald-200";
};
