import mongoose, { Schema, type Document } from "mongoose";

export interface IExcelPlanningTemplate extends Document {
  companyId: mongoose.Types.ObjectId;
  name?: string;
  mapping: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId;
}

const ExcelPlanningTemplateSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, trim: true },
    mapping: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model<IExcelPlanningTemplate>(
  "ExcelPlanningTemplate",
  ExcelPlanningTemplateSchema,
);
