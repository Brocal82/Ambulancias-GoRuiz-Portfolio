// frontend/src/types/appointment.ts
import type { User } from "../../users";

export type AppointmentStatus =
  | "pending"
  | "proposed"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "cancellation_requested";

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
  cancellationMessage?: string;
  createdAt: string;
  updatedAt: string;
}

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
  selectedSlot?: TimeSlot; // reprogramacion
}
