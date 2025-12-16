//src/utils/assignmentUtils.ts
import type { DienstAssignment, UpdateAssignment } from "../types/dienst";
import type { AssignedDayFull, AssignedDay } from "../types/dienst";

type FlexibleAssignment =
  | DienstAssignment
  | (UpdateAssignment & { _id?: string })
  | AssignedDay
  | AssignedDayFull; // añadimos AssignedDayFull

export const isPartialAssignment = (
  assignment: FlexibleAssignment | undefined,
): boolean => {
  if (!assignment) return false;

  const hasStart = !!assignment.startTime;
  const hasEnd = !!assignment.endTime;

  // driver y medic pueden ser string o objeto, chequeamos que no estén vacíos o nulos
  const hasDriver =
    assignment.driver !== null &&
    assignment.driver !== undefined &&
    assignment.driver !== "";
  const hasMedic =
    assignment.medic !== null &&
    assignment.medic !== undefined &&
    assignment.medic !== "";

  // Día libre (verde): sin horas
  if (!hasStart && !hasEnd) return false;

  // Parcial (amarillo): falta alguna hora o trabajador
  if (!hasStart || !hasEnd || !hasDriver || !hasMedic) return true;

  // Completo (azul): todo está presente
  return false;
};

export const isTeamIncomplete = (
  assignment: FlexibleAssignment | undefined,
): boolean => {
  if (!assignment) return false;

  const hasStart = !!assignment.startTime;
  const hasEnd = !!assignment.endTime;

  // Normalizamos driver/medic (pueden ser string u objeto)
  const hasDriver =
    assignment.driver !== null &&
    assignment.driver !== undefined &&
    assignment.driver !== "";
  const hasMedic =
    assignment.medic !== null &&
    assignment.medic !== undefined &&
    assignment.medic !== "";

  // Solo nos interesa marcar “incompleto” cuando ES un día trabajado (hay horas)
  if (!hasStart || !hasEnd) return false;

  // Equipo incompleto = exactamente uno de los dos asignado (XOR)
  return (hasDriver && !hasMedic) || (!hasDriver && hasMedic);
};
