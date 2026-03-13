import type { UpdateAssignment } from "../../domain/types";
import type { FlexibleAssignment } from "../../domain/types/flexibleAssignment";

export const buildUpdateAssignment = (params: {
  date: string;
  startTime: string;
  endTime: string;
  selectedDriverId: string;
  selectedMedicId: string;
  ambulanceId: string;
  assignment?: FlexibleAssignment;
}): UpdateAssignment => {
  const {
    date,
    startTime,
    endTime,
    selectedDriverId,
    selectedMedicId,
    ambulanceId,
    assignment,
  } = params;

  const updatedAssignment: UpdateAssignment = {
    date,
    startTime,
    endTime,
    driver: selectedDriverId,
    medic: selectedMedicId,
  };

  // ✅ Si viene _id (cuando el objeto lo trae), lo añadimos. Si no, no.
  const assignmentMongoId =
    assignment && typeof (assignment as any)._id === "string"
      ? ((assignment as any)._id as string)
      : undefined;

  if (assignmentMongoId) {
    updatedAssignment._id = assignmentMongoId;
  }

  const hadAmbulanceBefore =
    typeof assignment?.ambulanceId === "string"
      ? assignment.ambulanceId.trim().length > 0
      : assignment?.ambulanceId && typeof assignment.ambulanceId === "object"
        ? Boolean((assignment.ambulanceId as any)?._id)
        : false;

  if (ambulanceId && ambulanceId.trim() !== "") {
    updatedAssignment.ambulanceId = ambulanceId;
  } else if (hadAmbulanceBefore) {
    updatedAssignment.ambulanceId = "";
  }

  return updatedAssignment;
};
