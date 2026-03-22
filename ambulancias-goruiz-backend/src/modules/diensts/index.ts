// backend/src/modules/diensts/index.ts
// Módulo Diensts: instancias de turnos (Dienst), no plantillas (DienstTemplate)

export * as DienstAssignments from "./assignments";
export * as DienstCalendar from "./calendar";
export * as DienstLifecycle from "./templates";

export { getAllDienstsWithBasicPopulate } from "./calendar/services/calendar.service";
export { default as Dienst } from "./models/dienst.model";
export type { IDienst, IDienstAssignment } from "./models/dienst.model";
export type { AssignedDay, UserRef } from "./types/dienst.types";

