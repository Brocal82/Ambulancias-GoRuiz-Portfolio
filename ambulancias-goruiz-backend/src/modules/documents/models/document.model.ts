import mongoose, { Schema, Document as MongooseDocument, Types } from "mongoose";

export interface ICompanyDocument extends MongooseDocument {
  companyId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  targetWorkerId?: Types.ObjectId | null;
  /** Same id for all files created in one POST /api/documents/upload/batch request; null for single uploads. */
  uploadBatchId?: Types.ObjectId | null;
  originalName: string;
  filename: string;
  mimeType: string;
  /** Internal storage path (e.g. /uploads/...). Used by canAccessFile. */
  fileUrl: string;
  /** When false, workers can read but must not confirm reception (company documents module only). */
  requiresAcknowledgment: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

const CompanyDocumentSchema = new Schema<ICompanyDocument>(
  {
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
    targetWorkerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },
    uploadBatchId: {
      type: Schema.Types.ObjectId,
      required: false,
      default: null,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    requiresAcknowledgment: {
      type: Boolean,
      required: false,
      default: false,
    },
    deletedAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

CompanyDocumentSchema.index({ companyId: 1, createdAt: -1 });

export const CompanyDocument = mongoose.model<ICompanyDocument>(
  "CompanyDocument",
  CompanyDocumentSchema,
);

