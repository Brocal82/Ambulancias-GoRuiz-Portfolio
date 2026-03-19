// src/modules/workday/utils/workdayViewState.ts

/**
 * Estados posibles de la vista de jornada laboral.
 * Determina qué banner o contenido mostrar según disponibilidad.
 */
export type WorkdayViewState =
  | "closed"
  | "no_assignment"
  | "cant_start"
  | "ready";

/**
 * Calcula el estado de vista de la jornada según las reglas de negocio.
 * Orden: cerrado > sin asignación > aún no puede empezar > listo.
 */
export const getWorkdayViewState = (args: {
  isClosingDay: boolean;
  assignedDay: unknown;
  canStartWork: boolean;
}): WorkdayViewState => {
  if (args.isClosingDay) return "closed";
  if (!args.assignedDay) return "no_assignment";
  if (!args.canStartWork) return "cant_start";
  return "ready";
};
