import { apiRequest } from "./http";

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
  return apiRequest<AppointmentItem[]>("/appointments/my", {
    method: "GET",
    requiresAuth: true,
  });
}

export async function createAppointment(payload: {
  reason: string;
  details: string;
}): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>("/appointments/requests", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function selectSlot(
  id: string,
  payload: { selectedSlot: TimeSlot },
): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(`/appointments/${id}/select`, {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function rejectProposal(id: string): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(`/appointments/${id}/reject-proposal`, {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify({}),
  });
}

export async function requestCancellation(
  id: string,
  message: string,
): Promise<AppointmentItem> {
  return apiRequest<AppointmentItem>(`/appointments/${id}/request-cancel`, {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify({ message }),
  });
}

export async function deleteMyAppointment(id: string): Promise<void> {
  await apiRequest<void>(`/appointments/${id}/my`, {
    method: "DELETE",
    requiresAuth: true,
  });
}
