import mongoose, { Document, Schema, Types } from "mongoose";

export type PraemienManualDailyStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "reopened";

export interface IPraemienManualDailyEntry extends Document {
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Calendar day YYYY-MM-DD (local business day, same convention as workday summaries). */
  date: string;
  /** First worker-entered value for this row (immutable after set). */
  originalWorkerValue?: number;
  workerSubmittedValue: number;
  workerSubmittedAt: Date;
  /** Admin-approved final value (may differ from worker after correction). */
  adminFinalValue?: number | null;
  status: PraemienManualDailyStatus;
  rejectionReason?: string | null;
  adminReviewedAt?: Date | null;
  adminReviewedBy?: Types.ObjectId | null;
  reopenedAt?: Date | null;
  reopenedBy?: Types.ObjectId | null;
  reopenNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const praemienManualDailyEntrySchema = new Schema<IPraemienManualDailyEntry>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true, trim: true },
    originalWorkerValue: { type: Number, required: false, min: 0 },
    workerSubmittedValue: { type: Number, required: true, min: 0 },
    workerSubmittedAt: { type: Date, required: true },
    adminFinalValue: { type: Number, required: false, default: null, min: 0 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "reopened"],
      required: true,
      default: "submitted",
    },
    rejectionReason: { type: String, required: false, default: null, trim: true },
    adminReviewedAt: { type: Date, required: false, default: null },
    adminReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    reopenedAt: { type: Date, required: false, default: null },
    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    reopenNote: { type: String, required: false, default: null, trim: true },
  },
  { timestamps: true },
);

praemienManualDailyEntrySchema.index(
  { companyId: 1, userId: 1, date: 1 },
  { unique: true },
);

export default mongoose.model<IPraemienManualDailyEntry>(
  "PraemienManualDailyEntry",
  praemienManualDailyEntrySchema,
);
