import mongoose, { Document, Schema, Types } from "mongoose";

export type PraemienManualDailyStatus = "draft" | "submitted";

export interface IPraemienManualDailyEntry extends Document {
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Calendar day YYYY-MM-DD (local business day, same convention as workday summaries). */
  date: string;
  workerSubmittedValue: number;
  workerSubmittedAt: Date;
  status: PraemienManualDailyStatus;
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
    workerSubmittedValue: { type: Number, required: true, min: 0 },
    workerSubmittedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "submitted"],
      required: true,
      default: "submitted",
    },
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
