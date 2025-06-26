// backend/src/models/WorkdaySummary.ts
import mongoose, { Schema, Document } from "mongoose";

/* ─────────────────────────────────────────────
 * 1. Sub–schema de los viajes guardados
 * ───────────────────────────────────────────── */
interface TripEntry {
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;
  timeAtHome?: string;
  timePickup?: string;
  timeArrival?: string;
  timeEnd?: string;
  kmStart?: number;
  kmEnd?: number;
  wasCancelled: boolean;
  cancelledAtPickup?: boolean;
  reports?: string;
}

const tripSchema = new Schema<TripEntry>({
  auftragNumber:       { type: String, required: true },
  patientName:         { type: String, required: true },
  fromAddress:         { type: String, required: true },
  toAddress:           { type: String, required: true },
  timeWarning:         { type: String, required: true },
  timeAtHome:          { type: String, required: false },
  timePickup:          { type: String, required: false },
  timeArrival:         { type: String, required: false },
  timeEnd:             { type: String, required: false },
  kmStart:             { type: Number, required: false },
  kmEnd:               { type: Number, required: false },
  wasCancelled:        { type: Boolean, required: true },
  cancelledAtPickup:   { type: Boolean, default: false },
  reports:             { type: String, default: "" },
});

/* ─────────────────────────────────────────────
 * 2. Interface principal del resumen
 * ───────────────────────────────────────────── */
export interface IWorkdaySummary extends Document {
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm?: number;               // opcional en cierre parcial
  totalTripKm: number;
  trips: TripEntry[];
  isFinalClosure: boolean;
  partialClosureReason?: string;
  extraNote?: string;
}

/* ─────────────────────────────────────────────
 * 3. Schema principal del resumen
 * ───────────────────────────────────────────── */
const workdaySummarySchema = new Schema<IWorkdaySummary>({
  date:                { type: String, required: true },
  assignmentId:        { type: String, required: true },
  driver:              { type: String, required: true },
  medic:               { type: String, required: true },
  vehicleNumber:       { type: String, required: true },
  initialKm:           { type: Number, required: true },
  finalKm:             { type: Number, required: false },
  totalTripKm:         { type: Number, required: true },
  trips:               { type: [tripSchema], required: true },
  isFinalClosure:      { type: Boolean, default: true },
  partialClosureReason:{ type: String, default: "" },
  extraNote:            { type: String, default: "" },
});

/* ─────────────────────────────────────────────
 * 4. Export del modelo
 * ───────────────────────────────────────────── */
export default mongoose.model<IWorkdaySummary>(
  "WorkdaySummary",
  workdaySummarySchema
);


