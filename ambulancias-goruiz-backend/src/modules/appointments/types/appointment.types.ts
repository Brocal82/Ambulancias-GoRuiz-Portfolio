import { Types } from "mongoose";

export type AppointmentStatus =
  | "pending"
  | "proposed"
  | "confirmed"
  | "cancelled"
  | "rescheduled";

export interface TimeSlot {
  // Guardamos UTC; el cliente recibirá ISO.
  start: Date;
  end: Date;
}

export interface IAppointment {
  _id?: Types.ObjectId;
  workerId: Types.ObjectId;
  adminId?: Types.ObjectId; // quién gestiona/propone
  reason: string; // motivo corto
  details: string; // descripción larga
  status: AppointmentStatus;
  proposedSlots: TimeSlot[]; // máx 3, ordenados asc por start
  selectedSlot?: TimeSlot | null; // debe pertenecer a proposedSlots al confirmar
  companyId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}
