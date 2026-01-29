// frontend/src/modules/diensts/domain/types.ts
// FASE 2 (Paso 1): Tipos reales re-exportados desde legacy.
// Aún NO movemos src/types/dienst.ts para no romper imports existentes.
// En un paso posterior, migraremos el origen del export al módulo.

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

export type { FlexibleAssignment } from "../../../types/assignment";


