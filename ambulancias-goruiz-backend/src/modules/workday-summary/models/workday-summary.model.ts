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
  countsTrip: 0 | 1;
  reports?: string;
}

const tripSchema = new Schema<TripEntry>({
  auftragNumber: { type: String, required: true },
  patientName: { type: String, required: true },
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true },
  timeWarning: { type: String, required: true },
  timeAtHome: { type: String },
  timePickup: { type: String },
  timeArrival: { type: String },
  timeEnd: { type: String },
  kmStart: { type: Number },
  kmEnd: { type: Number },
  wasCancelled: { type: Boolean, required: true },
  cancelledAtPickup: { type: Boolean, default: false },
  countsTrip: { type: Number, enum: [0, 1], default: 1, required: true },
  reports: { type: String, default: "" },
});

/* ─────────────────────────────────────────────
 * 2. Interface principal del resumen
 * ───────────────────────────────────────────── */
export interface IWorkdaySummary extends Document {
  date: string;
  assignmentId: string;
  driver: Types.ObjectId;
  medic: Types.ObjectId;
  ambulanceId: Types.ObjectId;
  companyId?: Types.ObjectId | null;
  ambulanceNumber: string;
  dienstNumber?: number;
  startTime?: string;
  endTime?: string;
  initialKm: number;
  finalKm?: number;
  totalDienstKm: number;
  trips: TripEntry[];
  isFinalClosure: boolean;
  partialClosureReason?: string;
  extraNote?: string;
  totalEffectivePatients: number;
  totalRealTrips: number;

  /** 👇 NUEVO: estado de revisión para el dashboard */
  isReviewed: boolean;
  reviewedAt?: Date;
}

/* ─────────────────────────────────────────────
 * 3. Schema principal del resumen
 * ───────────────────────────────────────────── */
const workdaySummarySchema = new Schema<IWorkdaySummary>({
  date: { type: String, required: true },
  assignmentId: { type: String, required: true },
  driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
  medic: { type: Schema.Types.ObjectId, ref: "User", required: true },
  ambulanceId: {
    type: Schema.Types.ObjectId,
    ref: "Ambulance",
    required: true,
  },
  ambulanceNumber: { type: String, required: true },
  dienstNumber: { type: Number },
  startTime: { type: String },
  endTime: { type: String },
  initialKm: { type: Number, required: true },
  finalKm: { type: Number },
  totalDienstKm: { type: Number, required: true },
  trips: { type: [tripSchema], required: true },
  isFinalClosure: { type: Boolean, default: true },
  partialClosureReason: { type: String, default: "" },
  extraNote: { type: String, default: "" },
  totalEffectivePatients: { type: Number, required: true },
  totalRealTrips: { type: Number, required: true },

  /** 👇 NUEVO: revisión */
  isReviewed: { type: Boolean, default: false },
  reviewedAt: { type: Date },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: false,
    default: null,
  },
});

/** Un solo cierre final por assignment + día; los parciales no entran en el índice. */
workdaySummarySchema.index(
  { assignmentId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { isFinalClosure: true },
    name: "uniq_final_assignment_date",
  },
);

const WorkdaySummary =
  mongoose.models.WorkdaySummary ||
  mongoose.model<IWorkdaySummary>("WorkdaySummary", workdaySummarySchema);

export default WorkdaySummary;
