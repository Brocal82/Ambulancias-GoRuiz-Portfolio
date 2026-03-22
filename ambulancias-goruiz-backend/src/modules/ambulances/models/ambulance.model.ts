import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAmbulance extends Document {
  _id: Types.ObjectId;
  brand: string;
  modelName: string;
  licensePlate: string;
  ambulanceNumber: string;
}

const ambulanceSchema = new Schema<IAmbulance>({
  brand: { type: String, required: true },
  modelName: { type: String, required: true },
  licensePlate: { type: String, required: true, unique: true },
  ambulanceNumber: { type: String, required: true, unique: true },
});

export const Ambulance = mongoose.model<IAmbulance>("Ambulance", ambulanceSchema);
