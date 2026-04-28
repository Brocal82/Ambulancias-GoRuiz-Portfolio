import mongoose, { Document, Schema, Types } from "mongoose";

export type SupportAccessStatus =
  | "pending"
  | "approved"
  | "denied"
  | "revoked"
  | "expired";

export interface ISupportAccessRequest extends Document {
  companyId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  reason: string;
  ticketId: string;
  durationMinutes: number;
  status: SupportAccessStatus;
  approvalActors: Types.ObjectId[];
  approvalsRequired: number;
  approvalsCount: number;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewComment?: string;
  expiresAt?: Date;
  revokedBy?: Types.ObjectId;
  revokedAt?: Date;
  revokeReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const supportAccessRequestSchema = new Schema<ISupportAccessRequest>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true },
    ticketId: { type: String, required: true, trim: true, index: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 240 },
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    approvalActors: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    approvalsRequired: { type: Number, default: 2, min: 1, max: 3 },
    approvalsCount: { type: Number, default: 0, min: 0 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewComment: { type: String, trim: true },
    expiresAt: { type: Date, index: true },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date },
    revokeReason: { type: String, trim: true },
  },
  { timestamps: true },
);

const SupportAccessRequest = mongoose.model<ISupportAccessRequest>(
  "SupportAccessRequest",
  supportAccessRequestSchema,
);

export default SupportAccessRequest;
