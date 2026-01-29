// frontend/src/modules/diensts/assignments/adapters.ts
import type { UserRef, AssignedDay, DienstAssignment } from "../../../types/dienst";
import type { FlexibleAssignment } from "../../../types/assignment";

/**
 * Type guard: detecta UserRef (obj con _id).
 */
export const toUserRef = (v: unknown): UserRef | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const anyV = v as any;
  return typeof anyV._id === "string" ? (anyV as UserRef) : undefined;
};

/**
 * Normaliza ambulanceId a string siempre.
 */
export const normalizeAmbulanceId = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const anyV = v as any;
    if (typeof anyV._id === "string") return anyV._id;
  }
  return "";
};

/**
 * Convierte cualquier "assignment" conocido a FlexibleAssignment
 * (el tipo que entiende el AssignmentModal + mergeWithAssigned).
 *
 * NO cambia comportamiento, solo forma.
 */
export const toFlexibleAssignment = (
  a?: AssignedDay | DienstAssignment | FlexibleAssignment,
): FlexibleAssignment | undefined => {
  if (!a) return undefined;

  // Si ya parece FlexibleAssignment, lo devolvemos tal cual (pero normalizamos ambulanceId)
  const anyA = a as any;

  const driver = typeof anyA.driver === "string" ? anyA.driver : toUserRef(anyA.driver);
  const medic = typeof anyA.medic === "string" ? anyA.medic : toUserRef(anyA.medic);

  const normalized: FlexibleAssignment = {
    date: String(anyA.date ?? ""),
    startTime: String(anyA.startTime ?? ""),
    endTime: String(anyA.endTime ?? ""),
    ambulanceId: normalizeAmbulanceId(anyA.ambulanceId),
    ambulanceNumber: typeof anyA.ambulanceNumber === "string" ? anyA.ambulanceNumber : undefined,
    driver: driver ?? "",
    medic: medic ?? "",
  };

  return normalized;
};
