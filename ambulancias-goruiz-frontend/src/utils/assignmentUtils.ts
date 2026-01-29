// src/utils/assignmentUtils.ts

/**
 * Util de UI.
 * No depende de tipos de dominio (AssignedDay, DienstAssignment, etc).
 * Solo necesita saber si hay horas y personas asignadas.
 */
type AssignmentLike = {
  startTime?: string;
  endTime?: string;
  driver?: unknown;
  medic?: unknown;
};

const hasPerson = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== "";

export const isPartialAssignment = (
  assignment: AssignmentLike | null | undefined,
): boolean => {
  if (!assignment) return false;

  const hasStart = !!assignment.startTime;
  const hasEnd = !!assignment.endTime;

  const hasDriver = hasPerson(assignment.driver);
  const hasMedic = hasPerson(assignment.medic);

  // Día libre (verde)
  if (!hasStart && !hasEnd) return false;

  // Parcial (amarillo)
  if (!hasStart || !hasEnd || !hasDriver || !hasMedic) return true;

  // Completo (azul)
  return false;
};

export const isTeamIncomplete = (
  assignment: AssignmentLike | null | undefined,
): boolean => {
  if (!assignment) return false;

  const hasStart = !!assignment.startTime;
  const hasEnd = !!assignment.endTime;

  const hasDriver = hasPerson(assignment.driver);
  const hasMedic = hasPerson(assignment.medic);

  if (!hasStart || !hasEnd) return false;

  return (hasDriver && !hasMedic) || (!hasDriver && hasMedic);
};
