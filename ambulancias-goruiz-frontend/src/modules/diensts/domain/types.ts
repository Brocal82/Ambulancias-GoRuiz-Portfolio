// frontend/src/modules/diensts/domain/types.ts
import type { Ambulance } from "../../ambulances/domain/types";
/**
 * Domain types (source of truth)
 */

export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: "driver" | "medic" | "both";
  pscheinExpiry?: string;
  pscheinConfirmedAt?: string;
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
