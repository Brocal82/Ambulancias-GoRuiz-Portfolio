import type { UserRef } from "../types/dienst";
import type { FlexibleAssignment } from "../types/assignment";

export function mergeWithAssigned(
  availableUsers: UserRef[],
  assignment?: FlexibleAssignment
): UserRef[] {
  const merged = [...availableUsers];

  const currentDriver = typeof assignment?.driver === "object" ? assignment.driver : null;
  const currentMedic = typeof assignment?.medic === "object" ? assignment.medic : null;

  if (currentDriver && !availableUsers.some(u => u._id === currentDriver._id)) {
    merged.unshift(currentDriver);
  }

  if (currentMedic && !availableUsers.some(u => u._id === currentMedic._id)) {
    merged.unshift(currentMedic);
  }

  return merged;
}
