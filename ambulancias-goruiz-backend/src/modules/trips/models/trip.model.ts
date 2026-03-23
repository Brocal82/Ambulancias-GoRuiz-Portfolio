import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITrip extends Document {
  date: string;
  assignmentId: Types.ObjectId;
  driver: Types.ObjectId;
  medic: Types.ObjectId;
  companyId?: Types.ObjectId | null;
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
  sentInSummary: boolean;
}

const TripSchema = new Schema<ITrip>({
  date: { type: String, required: true },
  assignmentId: { type: Schema.Types.ObjectId, ref: "Dienst", required: true },
  driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
  medic: { type: Schema.Types.ObjectId, ref: "User", required: true },

  auftragNumber: { type: String, required: true },
  patientName: { type: String, required: true },
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true },

  timeWarning: { type: String, required: true },
  timeAtHome: { type: String, required: false },
  timePickup: { type: String, required: false },
  timeArrival: { type: String, required: false },
  timeEnd: { type: String, required: false },

  kmStart: { type: Number, required: false },
  kmEnd: { type: Number, required: false },

  wasCancelled: { type: Boolean, required: true },
  cancelledAtPickup: { type: Boolean, required: false },

  countsTrip: {
    type: Number,
    enum: [0, 1],
    default: 1,
    required: true,
  },

  reports: { type: String, default: "" },
  sentInSummary: { type: Boolean, default: false },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: false,
    default: null,
  },
});

export const Trip = mongoose.model<ITrip>("Trip", TripSchema);
