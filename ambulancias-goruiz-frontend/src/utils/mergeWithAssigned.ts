// src/utils/mergeWithAssigned.ts
import type { UserRef, AssignedDay } from "../modules/diensts";
import type { FlexibleAssignment } from "../types/assignment";

/**
 * Fusiona usuarios disponibles con el asignado actual, evitando duplicados.
 * Si un usuario ya está asignado en el otro rol y no tiene rol "both", no se vuelve a añadir.
 */
export function mergeWithAssigned(
  availableUsers: UserRef[],
  assignment: FlexibleAssignment | AssignedDay | undefined,
  currentRole: "driver" | "medic",
): UserRef[] {
  const otherRole = currentRole === "driver" ? "medic" : "driver";
  const otherVal = (assignment as any)?.[otherRole];
  const otherUser: UserRef | null =
    otherVal && typeof otherVal === "object" ? (otherVal as UserRef) : null;

  // Si el otro rol ya tiene a alguien y NO es "both", lo quitamos del listado del rol actual
  const merged =
    otherUser && otherUser.ambulanceRole !== "both"
      ? availableUsers.filter((u) => u._id !== otherUser._id)
      : [...availableUsers];

  const currentVal = (assignment as any)?.[currentRole];
  const currentUser: UserRef | null =
    currentVal && typeof currentVal === "object" ? (currentVal as UserRef) : null;

  // ✅ Asegura que el usuario actual se añade si no está en la lista
  const isAlreadyIncluded =
    currentUser && merged.some((u) => u._id === currentUser._id);

  const isConflictingWithOther =
    currentUser &&
    otherUser &&
    currentUser._id === otherUser._id &&
    currentUser.ambulanceRole !== "both";

  if (currentUser && !isAlreadyIncluded && !isConflictingWithOther) {
    merged.unshift(currentUser); // Lo colocamos al principio
  }

  return merged;
}
