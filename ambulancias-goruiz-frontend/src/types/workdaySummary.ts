// frontend/src/types/workdaySummary.ts
import type { Trip } from "./trip";   // ← ajusta la ruta si tu tipo Trip está en otro lugar

/** Payload que se envía al endpoint /workday-summary/partial */
export interface PartialSummaryPayload {
  date: string;
  assignmentId: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;       // ✅ nuevo obligatorio
  trips: Trip[];
  totalDienstKm: number;
  partialClosureReason: string;
  driver: string;        // ✅ nuevo obligatorio
  medic: string;         // ✅ nuevo obligatorio
  isFinalClosure?: false;
}

/** Payload que se envía al endpoint /workday-summary (cierre total) */
export interface FinalSummaryPayload {
  date: string;
  assignmentId: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
  totalDienstKm: number;
  trips: Trip[];
  driver: string;
  medic: string;
  extraNote?: string;
  finalClosureReason?: string; 
  isFinalClosure: true;
}

/** Tipo usado por el admin para visualizar cualquier resumen (final o parcial) */
export interface WorkdaySummary {
  _id: string;
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
  totalDienstKm: number;
  totalEffectivePatients: number;
  extraNote?: string;
  partialClosureReason?: string;
  isFinalClosure: boolean;
  trips: Trip[];
}



