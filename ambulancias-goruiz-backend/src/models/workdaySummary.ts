import mongoose, { Schema, Document } from "mongoose";

export interface IWorkdaySummary extends Document {
  date: string; // "YYYY-MM-DD"
  assignmentId: string;
  driver: string;
  medic: string;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
}

const workdaySummarySchema = new Schema<IWorkdaySummary>({
  date: { type: String, required: true },
  assignmentId: { type: String, required: true },
  driver: { type: String, required: true },
  medic: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  initialKm: { type: Number, required: true },
  finalKm: { type: Number, required: true },
});

export default mongoose.model<IWorkdaySummary>(
  "WorkdaySummary",
  workdaySummarySchema
);
