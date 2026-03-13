// src/modules/workday/domain/types/workdaySummary.ts

import type { Trip } from './trip';

export interface PopulatedUser {
  _id: string;
  name: string;
  lastName: string;
}

export interface PartialSummaryPayload {
  date: string;
  assignmentId: string;
  ambulanceId: string;
  ambulanceNumber?: string; // ✅ añadido
  initialKm: number;
  finalKm: number;
  trips: Trip[];
  totalDienstKm: number;
  partialClosureReason: string;
  driver: string;
  medic: string;
  isFinalClosure?: false;
  hasIssue?: boolean;
  dienstNumber?: number;
  startTime?: string;
  endTime?: string;
}

export interface FinalSummaryPayload {
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  ambulanceId: string;
  ambulanceNumber?: string; // ✅ añadido
  initialKm: number;
  finalKm?: number;
  totalDienstKm: number;
  trips: Trip[];
  extraNote?: string;
  isFinalClosure: boolean;
  hasIssue?: boolean;
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
  ambulanceId: string;
  ambulanceNumber?: string; // ✅ añadido
  initialKm: number;
  finalKm: number;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
  extraNote?: string;
  partialClosureReason?: string;
  isFinalClosure: boolean;
  hasIssue?: boolean;
  trips: Trip[];
  dienstNumber?: number;
  dienstId?: string;
  startTime?: string;
  endTime?: string;
}
