import type { DienstAssignment, UpdateAssignment } from "../types/dienst";

type FlexibleAssignment = DienstAssignment | (UpdateAssignment & { _id?: string });

export const isPartialAssignment = (assignment: FlexibleAssignment | undefined): boolean => {
  if (!assignment) return false;
  return !assignment.driver || !assignment.medic;
};
