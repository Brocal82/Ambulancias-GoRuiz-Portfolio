import mongoose, { Schema, Document, Types } from "mongoose";

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
  timeAtHome:          { type: String },
  timePickup:          { type: String },
  timeArrival:         { type: String },
  timeEnd:             { type: String },
  kmStart:             { type: Number },
  kmEnd:               { type: Number },
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
  driver: Types.ObjectId; // Referencia a User
  medic: Types.ObjectId;  // Referencia a User
  vehicleNumber: string;
  initialKm: number;
  finalKm?: number;
  totalDienstKm: number;
  trips: TripEntry[];
  isFinalClosure: boolean;
  partialClosureReason?: string;
  extraNote?: string;
  totalEffectivePatients: number;
  totalRealTrips: number;
}

/* ─────────────────────────────────────────────
 * 3. Schema principal del resumen
 * ───────────────────────────────────────────── */
const workdaySummarySchema = new Schema<IWorkdaySummary>({
  date:                { type: String, required: true },
  assignmentId:        { type: String, required: true },
  driver:              { type: Schema.Types.ObjectId, ref: "User", required: true },
  medic:               { type: Schema.Types.ObjectId, ref: "User", required: true },
  vehicleNumber:       { type: String, required: true },
  initialKm:           { type: Number, required: true },
  finalKm:             { type: Number },
  totalDienstKm:       { type: Number, required: true },
  trips:               { type: [tripSchema], required: true },
  isFinalClosure:      { type: Boolean, default: true },
  partialClosureReason:{ type: String, default: "" },
  extraNote:           { type: String, default: "" },
  totalEffectivePatients: { type: Number, required: true },
  totalRealTrips:        { type: Number, required: true },

});

/* ─────────────────────────────────────────────
 * 4. Export del modelo
 * ───────────────────────────────────────────── */
export default mongoose.model<IWorkdaySummary>(
  "WorkdaySummary",
  workdaySummarySchema
);
