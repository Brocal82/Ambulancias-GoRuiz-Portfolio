import type { Appointment, AppointmentStatus } from "../domain/types";

/** Worker puede elegir slot cuando hay propuesta activa con opciones */
export function canWorkerChooseSlot(appointment: Pick<Appointment, "status" | "proposedSlots">): boolean {
  return (
    appointment.status === "proposed" &&
    (appointment.proposedSlots?.length ?? 0) > 0
  );
}

/** Worker puede solicitar cancelación salvo si ya está en flujo de cancelación */
export function canWorkerRequestCancellation(status: AppointmentStatus): boolean {
  return status !== "cancellation_requested";
}

/** Admin puede proponer slots en pending */
export function canAdminProposeSlots(status: AppointmentStatus): boolean {
  return status === "pending";
}

/** Admin puede aceptar cancelación solicitada por el worker */
export function canAdminAcceptCancellation(status: AppointmentStatus): boolean {
  return status === "cancellation_requested";
}

/** Citas activas del worker (pendientes / propuestas / cancelación solicitada) */
export function isWorkerActiveAppointment(status: AppointmentStatus): boolean {
  return (
    status === "pending" ||
    status === "proposed" ||
    status === "cancellation_requested"
  );
}
