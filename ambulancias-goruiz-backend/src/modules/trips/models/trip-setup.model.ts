import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITripSetup extends Document {
  assignmentId: Types.ObjectId;
  date: string;
  ambulanceId?: string;
  ambulanceNumber: string;
  initialKm: number;
  companyId?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
}

const TripSetupSchema = new Schema<ITripSetup>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Dienst",
      required: true,
      unique: true,
      index: true,
    },
    date: { type: String, required: true },
    ambulanceId: { type: String, required: false },
    ambulanceNumber: { type: String, required: true },
    initialKm: { type: Number, required: true },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: false,
      default: null,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  { timestamps: true },
);

export const TripSetup = mongoose.model<ITripSetup>("TripSetup", TripSetupSchema);

