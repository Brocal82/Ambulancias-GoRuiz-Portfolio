// frontend/src/modules/diensts/domain/adapters/assignmentAdapter.ts
import type {
  AssignedDay,
  AssignedDayFull,
  UserRef,
} from "../types";

/**
 * Normaliza un UserRef posible (id | UserRef | undefined)
 */
const toUserRef = (
  value: string | UserRef | undefined,
): UserRef | null => {
  if (!value) return null;
  if (typeof value === "string") return null;
  if (typeof value === "object" && typeof value._id === "string") {
    return value;
  }
  return null;
};

/**
 * Convierte AssignedDay → AssignedDayFull si es posible
 * Devuelve null si no hay datos suficientes
 */
export const toAssignedDayFull = (
  day: AssignedDay,
): AssignedDayFull | null => {
  const driver = toUserRef(day.driver);
  const medic = toUserRef(day.medic);

  if (!driver || !medic) return null;

  return {
    ...day,
    driver,
    medic,
    ambulanceId: day.ambulanceId as any,
  };
};

/**
 * Convierte lista filtrando inválidos
 */
export const toAssignedDayFullList = (
  days: AssignedDay[],
): AssignedDayFull[] =>
  days
    .map(toAssignedDayFull)
    .filter((d): d is AssignedDayFull => d !== null);
