import mongoose, { Schema, type Document } from "mongoose";

export type ExcelPlanMatchMethod = "employee_number" | "name_auto" | "none";

export interface IExcelPlanRow {
  dayIndex: number;
  dayDate: Date;
  dienstNumber: string;
  rowLabel?: string;
  timeText?: string;
  vehicleCode?: string;
  employeeNumber?: string;
  partnerEmployeeNumber?: string;
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
  rawCellText: string;
  matchedUserId?: mongoose.Types.ObjectId;
  /** Segundo integrante del equipo (compañero), si se resolvió por nombre único en la empresa. */
  matchedPartnerUserId?: mongoose.Types.ObjectId;
  matchMethod: ExcelPlanMatchMethod;
  matchWarning?: string;
}

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

export interface IExcelPlanningImport extends Document {
  companyId: mongoose.Types.ObjectId;
  templateId?: mongoose.Types.ObjectId;
  status: "draft" | "published" | "discarded";
  storedFilename: string;
  originalFilename: string;
  fileUrl: string;
  weekStartDetected?: Date;
  parseErrors: string[];
  previewRows: IExcelPlanRow[];
  stats?: {
    totalCells: number;
    matchedByNumber: number;
    matchedByName: number;
    unmatched: number;
    /** Nº de claves (normalizadas) en conflicto: dos+ trabajadores con el mismo valor. */
    numberKeyCollisions?: number;
    collidingKeysSample?: string[];
  };
  createdBy?: mongoose.Types.ObjectId;
}

const ExcelPlanningImportSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    templateId: { type: Schema.Types.ObjectId, ref: "ExcelPlanningTemplate" },
    status: {
      type: String,
      enum: ["draft", "published", "discarded"],
      default: "draft",
    },
    storedFilename: { type: String, required: true },
    originalFilename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    weekStartDetected: { type: Date },
    parseErrors: { type: [String], default: [] },
    previewRows: { type: [PlanRowSubSchema], default: [] },
    stats: {
      totalCells: Number,
      matchedByNumber: Number,
      matchedByName: Number,
      unmatched: Number,
      numberKeyCollisions: { type: Number, required: false },
      collidingKeysSample: { type: [String], required: false },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model<IExcelPlanningImport>(
  "ExcelPlanningImport",
  ExcelPlanningImportSchema,
);
