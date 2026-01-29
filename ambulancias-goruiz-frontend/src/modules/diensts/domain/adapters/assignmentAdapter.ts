// frontend/src/modules/diensts/domain/adapters/assignmentAdapter.ts

import type { AssignedDay, DienstAssignment, UserRef } 
from "../../../../modules/diensts";


/**
 * Convierte cualquier forma de driver/medic a UserRef usable.
 * - Si viene como objeto con _id => OK
 * - Si viene como string => placeholder (no rompe UI)
 * - Si viene undefined/null => null
 */
export const toUserRefOrNull = (v: unknown): UserRef | null => {
  if (!v) return null;

  // string => placeholder (para que no crashee MyWorkDay con driver._id)
  if (typeof v === "string") {
    return { _id: v, name: "", lastName: "" };
  }

  // object => validar _id
  if (typeof v === "object") {
    const anyV = v as any;
    if (typeof anyV._id === "string") {
      return {
        _id: anyV._id,
        name: typeof anyV.name === "string" ? anyV.name : "",
        lastName: typeof anyV.lastName === "string" ? anyV.lastName : "",
        ambulanceRole: anyV.ambulanceRole,
        pscheinExpiry: anyV.pscheinExpiry,
      };
    }
  }

  return null;
};

/**
 * Normaliza un AssignedDay para que driver/medic sean siempre UserRef | undefined
 */
export const adaptAssignedDay = (d: AssignedDay): AssignedDay => {
  const driver = toUserRefOrNull(d.driver) ?? undefined;
  const medic = toUserRefOrNull(d.medic) ?? undefined;

  return {
    ...d,
    driver,
    medic,
  };
};

/**
 * Normaliza un DienstAssignment para que driver/medic sean estables (nunca undefined raro).
 */
export const adaptDienstAssignment = (a: DienstAssignment): DienstAssignment => {
  const driver =
    toUserRefOrNull(a.driver) ?? (typeof a.driver === "string" ? a.driver : "");
  const medic =
    toUserRefOrNull(a.medic) ?? (typeof a.medic === "string" ? a.medic : "");

  return {
    ...a,
    driver,
    medic,
  };
};

/**
 * Helper opcional: extrae ambulanceId como string si viene poblado como objeto.
 */
export const normalizeAmbulanceIdToString = (ambulanceId: unknown): string => {
  if (!ambulanceId) return "";
  if (typeof ambulanceId === "string") return ambulanceId;
  if (typeof ambulanceId === "object") {
    const anyA = ambulanceId as any;
    return typeof anyA._id === "string" ? anyA._id : "";
  }
  return "";
};
