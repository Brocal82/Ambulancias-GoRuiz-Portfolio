import mongoose, { Schema, type Document } from "mongoose";
import type { IExcelPlanRow } from "./excel-planning-import.model";

const PlanRowSubSchema = new Schema(
  {
    dayIndex: { type: Number, required: true },
    dayDate: { type: Date, required: true },
    dienstNumber: { type: String, required: true },
    rowLabel: { type: String },
    timeText: { type: String },
    vehicleCode: { type: String },
    employeeNumber: { type: String },
    partnerEmployeeNumber: { type: String },
    displayNameFromExcel: { type: String },
    displayPartnerNameFromExcel: { type: String },
    rawCellText: { type: String, required: true },
    matchedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    matchedPartnerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    matchMethod: {
      type: String,
      enum: ["employee_number", "name_auto", "none"],
      required: true,
    },
    matchWarning: { type: String },
  },
  { _id: false },
);

export interface IExcelPlanningWeek extends Document {
  companyId: mongoose.Types.ObjectId;
  weekStart: Date;
  rows: IExcelPlanRow[];
  sourceStoredFilename?: string;
  sourceFileUrl?: string;
  importId?: mongoose.Types.ObjectId;
  templateId?: mongoose.Types.ObjectId;
  normalizeEmployeeNumber?: "trim" | "trim_strip_leading_zeros";
  publishedBy?: mongoose.Types.ObjectId;
  publishedAt?: Date;
}

const ExcelPlanningWeekSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    weekStart: { type: Date, required: true },
    rows: { type: [PlanRowSubSchema], default: [] },
    sourceStoredFilename: { type: String },
    sourceFileUrl: { type: String },
    importId: { type: Schema.Types.ObjectId, ref: "ExcelPlanningImport" },
    templateId: { type: Schema.Types.ObjectId, ref: "ExcelPlanningTemplate" },
    /** Copiado de la plantilla al publicar; sirve para comparar employeeNumber en vista worker. */
    normalizeEmployeeNumber: {
      type: String,
      enum: ["trim", "trim_strip_leading_zeros"],
    },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

ExcelPlanningWeekSchema.index({ companyId: 1, weekStart: 1 }, { unique: true });

export default mongoose.model<IExcelPlanningWeek>(
  "ExcelPlanningWeek",
  ExcelPlanningWeekSchema,
);
