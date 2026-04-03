import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Payroll document metadata.
 *
 * Phase 1 scope:
 *  - Admin uploads a PDF payslip for a specific worker.
 *  - companyId is REQUIRED and never null (no legacy fallback needed for new records).
 *  - fileUrl follows the existing /uploads/<filename> convention so that
 *    canAccessFile can resolve it from GET /api/files/:filename.
 *  - year and month are optional — manual metadata for now, no auto-parsing.
 */
export interface IPayrollDocument extends Document {
  workerId: Types.ObjectId;
  companyId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  filename: string;
  originalName: string;
  fileUrl: string;
  year?: number;
  month?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollDocumentSchema = new Schema<IPayrollDocument>(
  {
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: false,
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      required: false,
    },
  },
  { timestamps: true },
);

PayrollDocumentSchema.index({ companyId: 1, workerId: 1, year: 1, month: 1 });

const PayrollDocument = mongoose.model<IPayrollDocument>(
  "PayrollDocument",
  PayrollDocumentSchema,
);

export default PayrollDocument;
