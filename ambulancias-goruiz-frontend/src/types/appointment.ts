// frontend/src/types/appointment.ts
import type { User } from "../modules/users";

export type AppointmentStatus =
  | "pending"
  | "proposed"
  | "confirmed"
  | "cancelled"
  | "rescheduled";

export interface TimeSlot {
  start: string; // ISO UTC
  end: string; // ISO UTC
}

export interface Appointment {
  _id: string;
  workerId: string | Pick<User, "_id" | "name" | "lastName" | "email">;
  adminId?: string | Pick<User, "_id" | "name" | "lastName" | "email">;
  reason: string;
  details: string;
  status: AppointmentStatus;
  proposedSlots: TimeSlot[];
  selectedSlot?: TimeSlot | null;
  createdAt: string;
  updatedAt: string;
}

// Payloads
export interface RequestAppointmentPayload {
  reason: string;
  details: string;
}
export interface ProposeSlotsPayload {
  proposedSlots: TimeSlot[];
}
export interface SelectSlotPayload {
  selectedSlot: TimeSlot;
}
export interface UpdateAppointmentPayload {
  reason?: string;
  details?: string;
  selectedSlot?: TimeSlot; // reprogramación
}
