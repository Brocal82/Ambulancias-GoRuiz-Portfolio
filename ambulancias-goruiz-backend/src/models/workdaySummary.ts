import mongoose, { Schema, Document } from "mongoose";

interface TripEntry {
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;
  kmStart: number;
  kmEnd: number;
  wasCancelled: boolean;
  cancelledAtPickup: boolean;
  reports?: string;
}

export interface IWorkdaySummary extends Document {
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
  trips: TripEntry[]; // ✅ Añadido
}

const tripSchema = new Schema<TripEntry>({
  auftragNumber: String,
  patientName: String,
  fromAddress: String,
  toAddress: String,
  timeWarning: String,
  timePickup: String,
  timeArrival: String,
  timeEnd: String,
  kmStart: Number,
  kmEnd: Number,
  wasCancelled: Boolean,
  cancelledAtPickup: Boolean,
  reports: String,
});

const workdaySummarySchema = new Schema<IWorkdaySummary>({
  date: { type: String, required: true },
  assignmentId: { type: String, required: true },
  driver: { type: String, required: true },
  medic: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  initialKm: { type: Number, required: true },
  finalKm: { type: Number, required: true },
  trips: { type: [tripSchema], required: true }, // ✅ Añadido
});

export default mongoose.model<IWorkdaySummary>(
  "WorkdaySummary",
  workdaySummarySchema
);
