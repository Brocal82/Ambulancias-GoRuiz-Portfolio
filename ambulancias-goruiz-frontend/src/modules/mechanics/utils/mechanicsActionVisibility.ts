import type { AppRole } from "../../users/domain/types";
import type { MechanicsWorkOrder } from "../domain/types";

/** Admin o jefe de mecánicos pueden planificar órdenes y cancelar pendientes/en curso */
export function canPlanMechanicsWorkOrders(role: AppRole | string | null): boolean {
  return role === "admin" || role === "jefe_mecanicos";
}

/** Mecánico puede iniciar/completar órdenes asignadas o sin asignar (auto-asignación al iniciar) */
export function isMechanicsOperatorRole(role: AppRole | string | null): boolean {
  return role === "mecanico";
}

export function canDeleteMechanicsIssues(role: AppRole | string | null): boolean {
  return role === "admin" || role === "jefe_mecanicos";
}

export function canMechanicStartWorkOrder(
  role: AppRole | string | null,
  status: MechanicsWorkOrder["status"],
): boolean {
  return isMechanicsOperatorRole(role) && status === "pending";
}

export function canMechanicCompleteWorkOrder(
  role: AppRole | string | null,
  status: MechanicsWorkOrder["status"],
): boolean {
  return isMechanicsOperatorRole(role) && status === "in_progress";
}

export function canPlanCancelWorkOrder(
  role: AppRole | string | null,
  status: MechanicsWorkOrder["status"],
): boolean {
  return (
    canPlanMechanicsWorkOrders(role) &&
    (status === "pending" || status === "in_progress")
  );
}
