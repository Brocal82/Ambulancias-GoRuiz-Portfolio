import { isPartialAssignment } from "../../../utils/assignmentUtils";

export type AssignmentStatus = "off" | "partial" | "full";

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
 * Mapea status -> clases Tailwind EXACTAS actuales.
 */
export const getStatusClass = (status: AssignmentStatus): string => {
  if (status === "partial") return "bg-amber-50 ring-amber-200";
  if (status === "full") return "bg-blue-100 ring-blue-300";
  return "bg-emerald-50 ring-emerald-200";
};
