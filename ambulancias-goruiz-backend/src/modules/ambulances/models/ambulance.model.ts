import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAmbulance extends Document {
  _id: Types.ObjectId;
  brand: string;
  modelName: string;
  licensePlate: string;
  ambulanceNumber: string;
  companyId: Types.ObjectId;
}

const ambulanceSchema = new Schema<IAmbulance>({
  brand: { type: String, required: true },
  modelName: { type: String, required: true },
  licensePlate: { type: String, required: true },
  ambulanceNumber: { type: String, required: true },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
});

ambulanceSchema.index(
  { companyId: 1, licensePlate: 1 },
  { unique: true, name: "companyId_licensePlate_unique" },
);
ambulanceSchema.index(
  { companyId: 1, ambulanceNumber: 1 },
  { unique: true, name: "companyId_ambulanceNumber_unique" },
);

export const Ambulance = mongoose.model<IAmbulance>("Ambulance", ambulanceSchema);
