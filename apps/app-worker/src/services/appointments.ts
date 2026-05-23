import { apiRequest } from "./http";
import { APPOINTMENT_API_PATHS } from "./appointmentPaths";

export type AppointmentStatus = "pending" | "proposed" | "confirmed" | "cancelled" | "rescheduled" | "cancellation_requested";

export interface TimeSlot {
  start: string;
  end: string;
}

export interface AppointmentItem {
  _id: string;
  workerId: string;
  adminId?: string;
  reason: string;
  details: string;
  status: AppointmentStatus;
  proposedSlots: TimeSlot[];
  selectedSlot?: TimeSlot | null;
  cancellationMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getMyAppointments(): Promise<AppointmentItem[]> {
  return apiRequest<AppointmentItem[]>(APPOINTMENT_API_PATHS.my, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function createAppointment(payload: {
  reason: string;
  details: string;
}): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(APPOINTMENT_API_PATHS.requests, {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function selectSlot(
  id: string,
  payload: { selectedSlot: TimeSlot },
): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(APPOINTMENT_API_PATHS.select(id), {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function rejectProposal(id: string): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(APPOINTMENT_API_PATHS.rejectProposal(id), {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify({}),
  });
}

export async function requestCancellation(
  id: string,
  message: string,
): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(APPOINTMENT_API_PATHS.requestCancel(id), {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify({ message }),
  });
}

export async function deleteMyAppointment(id: string): Promise<void> {
  await apiRequest<void>(APPOINTMENT_API_PATHS.deleteMy(id), {
    method: "DELETE",
    requiresAuth: true,
  });
}
