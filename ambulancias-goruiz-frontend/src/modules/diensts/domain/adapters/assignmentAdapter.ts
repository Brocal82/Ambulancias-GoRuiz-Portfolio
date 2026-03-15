// frontend/src/modules/diensts/domain/adapters/assignmentAdapter.ts

import type { AssignedDay, DienstAssignment, UserRef } from "../types";
import type { FlexibleAssignment } from "../types/flexibleAssignment";

/**
 * Convierte cualquier forma de driver/medic a UserRef usable.
 * - Si viene como objeto con _id => OK
 * - Si viene como string no vacío => placeholder seguro
 * - Si viene undefined / null / string vacío => null
 */
export const toUserRefOrNull = (v: unknown): UserRef | null => {
  if (!v) return null;

  // string => placeholder seguro
  if (typeof v === "string") {
    const id = v.trim();
    if (!id) return null;
    return { _id: id, name: "", lastName: "" };
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
 * Normaliza un DienstAssignment para que driver/medic sean estables
 * (nunca undefined raro ni objeto inconsistente)
 */
export const adaptDienstAssignment = (
  a: DienstAssignment,
): DienstAssignment => {
  const driver =
    toUserRefOrNull(a.driver) ??
    (typeof a.driver === "string" ? a.driver : "");

  const medic =
    toUserRefOrNull(a.medic) ??
    (typeof a.medic === "string" ? a.medic : "");

  return {
    ...a,
    driver,
    medic,
  };
};

/**
 * Helper opcional: extrae ambulanceId como string
 * si viene poblado como objeto.
 */
export const normalizeAmbulanceIdToString = (
  ambulanceId: unknown,
): string => {
  if (!ambulanceId) return "";
  if (typeof ambulanceId === "string") return ambulanceId;

  if (typeof ambulanceId === "object") {
    const anyA = ambulanceId as any;
    return typeof anyA._id === "string" ? anyA._id : "";
  }

  return "";
};

/**
 * Convierte AssignedDay (worker/admin-user) al contrato estable del modal: FlexibleAssignment
 * - Mantiene exactamente los campos que hoy se pasan al modal
 * - Normaliza ambulanceId a string
 * - _id se toma de assignmentId (id estable para UI)
 */
export const toFlexibleFromAssignedDay = (
  d?: AssignedDay,
): FlexibleAssignment | undefined => {
  if (!d) return undefined;

  const ambulanceId = normalizeAmbulanceIdToString(d.ambulanceId);

  return {
    _id: d.assignmentId,
    date: d.date,
    startTime: d.startTime,
    endTime: d.endTime,
    ambulanceId,
    ambulanceNumber: d.ambulanceNumber,
    driver: (d.driver ?? "") as any,
    medic: (d.medic ?? "") as any,
  };
};

/**
 * Convierte DienstAssignment (admin) al contrato estable del modal: FlexibleAssignment
 * - Normaliza ambulanceId a string si viene poblado como objeto
 * - Si _id viene como string lo preserva
 */
export const toFlexibleFromDienstAssignment = (
  a?: DienstAssignment,
): FlexibleAssignment | undefined => {
  if (!a) return undefined;

  const ambulanceId = normalizeAmbulanceIdToString(a.ambulanceId);

  return {
    _id: typeof (a as any)._id === "string" ? (a as any)._id : undefined,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    ambulanceId,
    ambulanceNumber:
      a.ambulanceId && typeof a.ambulanceId === "object"
        ? ((a.ambulanceId as any)?.ambulanceNumber as string | undefined)
        : undefined,
    driver: (a.driver ?? "") as any,
    medic: (a.medic ?? "") as any,
  } as FlexibleAssignment;
};

