import type { UserRef } from "../types/dienst";
import type { FlexibleAssignment } from "../types/assignment";

/**
 * Fusiona usuarios disponibles con el asignado actual, evitando duplicados.
 * Si un usuario ya está asignado en el otro rol, no se vuelve a añadir.
 */
export function mergeWithAssigned(
  availableUsers: UserRef[],
  assignment: FlexibleAssignment | undefined,
  currentRole: "driver" | "medic"
): UserRef[] {
  const merged = [...availableUsers];

  const currentUser =
    typeof assignment?.[currentRole] === "object" ? assignment[currentRole] : null;

  const otherRole = currentRole === "driver" ? "medic" : "driver";
  const otherUser =
    typeof assignment?.[otherRole] === "object" ? assignment[otherRole] : null;

  // ✅ Asegura que el usuario actual (con todos sus datos) se añade si no está en la lista
  if (
    currentUser &&
    !merged.some(u => u._id === currentUser._id) &&
    currentUser._id !== otherUser?._id
  ) {
    merged.unshift(currentUser); // lo colocamos al principio
  }

  return merged;
}
