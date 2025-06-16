// backend/src/models/Trip.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrip extends Document {
  date: string;
  assignmentId: Types.ObjectId;
  driver: Types.ObjectId;
  medic: Types.ObjectId;
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;
  timeAtHome: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;
  kmStart: number;
  kmEnd: number;
  wasCancelled: boolean;
  reports?: string; // ✅ Añadido
}

const TripSchema = new Schema<ITrip>({
  date: { type: String, required: true },
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Dienst', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  medic: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  auftragNumber: { type: String, required: true },
  patientName: { type: String, required: true },
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true },
  timeWarning: { type: String, required: true },
  timeAtHome: { type: String, required: true },
  timePickup: { type: String, required: true },
  timeArrival: { type: String, required: true },
  timeEnd: { type: String, required: true },
  kmStart: { type: Number, required: true },
  kmEnd: { type: Number, required: true },
  wasCancelled: { type: Boolean, required: true },
  reports: { type: String, required: false, default: '' }, // ✅ Añadido aquí
});

export default mongoose.model<ITrip>('Trip', TripSchema);

