// frontend/src/types/dienst.ts
import type { Ambulance } from "./ambulance";

export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: 'driver' | 'medic' | 'both';
  pscheinExpiry?: string;
}

export interface DienstAssignment {
  _id: string;
  date: string;
  ambulanceId?: string | { _id: string; ambulanceNumber: string };
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
  ambulanceId: string;
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
  ambulanceId?: string;
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





