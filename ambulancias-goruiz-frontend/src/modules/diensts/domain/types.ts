// frontend/src/modules/diensts/domain/types.ts
import type { Ambulance } from "../../../types/ambulance";

/**
 * Domain types (source of truth)
 */

export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: "driver" | "medic" | "both";
  pscheinExpiry?: string;
}

export interface DienstAssignment {
  _id: string;
  date: string;
  ambulanceId?: string | Ambulance;
  ambulanceNumber?: string;
  startTime: string;
  endTime: string;
  driver: string | UserRef;
  medic: string | UserRef;
}

export interface Dienst {
  _id: string;
  dienstNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  assignments: DienstAssignment[];
}

export interface UpdateAssignment {
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  ambulanceId?: string | null;
  driver: string;
  medic: string;
}

export interface AssignedDay {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;

  ambulanceId?: string | Ambulance;
  ambulanceNumber?: string;

  driver?: string | UserRef;
  medic?: string | UserRef;
}

export interface AssignedDayFull {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  ambulanceId?: string | Ambulance;
  ambulanceNumber?: string;
  driver: UserRef;
  medic: UserRef;
}

// 🗓️ Horario por día de la semana para una plantilla
export interface DaySchedule {
  dayIndex: number; // 0=domingo...6=sábado
  startTime?: string;
  endTime?: string;
  isOff: boolean;
}

// 📌 Plantilla de Dienst
export interface DienstTemplate {
  _id: string;
  dienstNumber: number;
  startTime: string;
  endTime: string;
  daysOff: number[];
  isActive: boolean;
  perDaySchedule?: DaySchedule[];
}

/**
 * UI/compat type (legacy)
 * Nota: FlexibleAssignment NO es estrictamente "domain", pero se re-exporta aquí
 * para que el frontend tenga un único punto de entrada.
 */
export type { FlexibleAssignment } from "../../../types/assignment";
