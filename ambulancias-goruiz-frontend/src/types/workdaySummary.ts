// frontend/src/types/workdaySummary.ts
import type { Trip } from "./trip";

export interface PopulatedUser {
  _id: string;
  name: string;
  lastName: string;
}

export interface PartialSummaryPayload {
  // igual que antes...
  date: string;
  assignmentId: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
  trips: Trip[];
  totalDienstKm: number;
  partialClosureReason: string;
  driver: string;
  medic: string;
  isFinalClosure?: false;
  dienstNumber?: number;
  startTime?: string;
  endTime?: string;

}

export interface FinalSummaryPayload {
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm?: number;
  totalDienstKm: number;
  trips: Trip[];
  extraNote?: string;
  isFinalClosure: boolean;
  dienstNumber: number;
  startTime: string;
  endTime: string;
}


/**
 * Tipo usado por el admin para visualizar cualquier resumen (final o parcial).
 * Driver y Medic son strings o objetos poblados.
 */
export interface WorkdaySummary {
  _id: string;
  date: string;
  assignmentId: string;
  driver: string | PopulatedUser;
  medic: string | PopulatedUser;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
  extraNote?: string;
  partialClosureReason?: string;
  isFinalClosure: boolean;
  trips: Trip[];
  dienstNumber?: number;
  dienstId?: string;
  startTime?: string;
  endTime?: string;
}

