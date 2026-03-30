import mongoose, { Schema, Document } from "mongoose";

export interface IMonthlyPraemie extends Document {
  userId: string;
  companyId: mongoose.Types.ObjectId | null;
  year: number;
  month: number; // 1-12
  averagePatients: number;
  premieLevel: string;
  createdAt: Date;
}

const monthlyPraemieSchema = new Schema<IMonthlyPraemie>({
  userId: { type: String, required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  averagePatients: { type: Number, required: true },
  premieLevel: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

monthlyPraemieSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model<IMonthlyPraemie>(
  "MonthlyPraemie",
  monthlyPraemieSchema,
);
