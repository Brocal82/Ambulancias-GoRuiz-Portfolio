import type { DienstAssignment, UpdateAssignment } from "../types/dienst";

type FlexibleAssignment = DienstAssignment | (UpdateAssignment & { _id?: string });

export const isPartialAssignment = (assignment: FlexibleAssignment | undefined): boolean => {
  if (!assignment) return false;

  const hasStart = !!assignment.startTime;
  const hasEnd = !!assignment.endTime;

  const hasDriver = !!assignment.driver;
  const hasMedic = !!assignment.medic;

  // Si no tiene horas, lo consideramos día libre (verde)
  if (!hasStart && !hasEnd) return false;

  // Si faltan horas o trabajadores, lo consideramos parcial (amarillo)
  if (!hasStart || !hasEnd || !hasDriver || !hasMedic) return true;

  // Si tiene todo, es completo (azul)
  return false;
};

