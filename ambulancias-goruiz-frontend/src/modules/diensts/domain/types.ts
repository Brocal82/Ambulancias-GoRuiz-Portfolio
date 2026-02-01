// frontend/src/modules/diensts/domain/types.ts
// FASE 2 (Paso 1): Tipos reales re-exportados desde legacy.
// Aún NO movemos src/types/dienst.ts para no romper imports existentes.
// En un paso posterior, migraremos el origen del export al módulo.

/** Domain types (legacy source for now) */
export type {
  Dienst,
  DienstAssignment,
  UserRef,
  UpdateAssignment,
  AssignedDay,
  AssignedDayFull,
  DienstTemplate,
  DaySchedule,
} from "../../../types/dienst";

/**
 * UI/compat type (legacy)
 * Nota: FlexibleAssignment NO es estrictamente "domain", pero se re-exporta aquí
 * para que el frontend tenga un único punto de entrada.
 */
export type { FlexibleAssignment } from "../../../types/assignment";



