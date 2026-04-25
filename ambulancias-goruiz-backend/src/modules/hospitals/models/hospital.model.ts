import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHospital extends Document {
  name: string;
  address: string;
  phone: string;
  specialties: string[];
  isOpen: boolean;
  companyId: Types.ObjectId;
}

const HospitalSchema = new Schema<IHospital>({
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  specialties: [{ type: String, required: true }],
  isOpen: { type: Boolean, default: true },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
});

/** Listados por tenant y búsquedas por nombre dentro de la empresa. */
HospitalSchema.index({ companyId: 1, name: 1 });

export const Hospital = mongoose.model<IHospital>("Hospital", HospitalSchema);
