import type { DienstAssignment, UpdateAssignment } from "../types/dienst";
import type { AssignedDay } from "../types/assignedDay";

type FlexibleAssignment =
  | DienstAssignment
  | (UpdateAssignment & { _id?: string })
  | AssignedDay;

export const isPartialAssignment = (assignment: FlexibleAssignment | undefined): boolean => {
  if (!assignment) return false;

  const hasStart = !!assignment.startTime;
  const hasEnd = !!assignment.endTime;
  const hasDriver = !!assignment.driver;
  const hasMedic = !!assignment.medic;

  // Día libre (verde): sin horas
  if (!hasStart && !hasEnd) return false;

  // Parcial (amarillo): falta alguna hora o trabajador
  if (!hasStart || !hasEnd || !hasDriver || !hasMedic) return true;

  // Completo (azul): todo está presente
  return false;
};

