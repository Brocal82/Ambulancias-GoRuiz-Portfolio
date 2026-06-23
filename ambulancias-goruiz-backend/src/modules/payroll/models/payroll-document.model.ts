import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Payroll document metadata.
 *
 * Phase 1: Admin explicitly provides workerId → matchStatus "manual".
 * Phase 2: Admin may omit workerId → conservative filename parsing attempts
 *          to resolve it. If parsing succeeds with exactly one match →
 *          matchStatus "matched". Otherwise → workerId null, matchStatus
 *          "unmatched" (document held for admin review / manual assignment).
 *
 * companyId is REQUIRED and never null — no legacy fallback needed.
 * fileUrl stays in the DB for canAccessFile lookups but is never sent to clients.
 */

export type PayrollMatchStatus = "manual" | "matched" | "unmatched";

export interface IPayrollDocument extends Document {
  /** Worker who owns this payslip. Null only for unmatched (review-needed) docs. */
  workerId: Types.ObjectId | null;
  companyId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  filename: string;
  originalName: string;
  /** Internal storage path — never exposed to clients. Used by canAccessFile. */
  fileUrl: string;
  year?: number;
  month?: number;
  /** How workerId was determined. */
  matchStatus: PayrollMatchStatus;
  /** Employee number extracted from the filename (if any). Snapshot for admin review. */
  parsedEmployeeNumber?: string;
  /** Human-readable explanation of why the document was matched or not matched. */
  matchReason?: string;
  /**
   * Soft-delete timestamp. Null = active document. Non-null = invalidated by admin.
   * Invalidated documents are excluded from all listings, coverage checks, duplicate
   * detection, assignment, and file access. The DB record and file on disk are retained
   * to allow future restore.
   */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // ── P1.3: Open evidence (compliance hardening) ────────────────────────────
  /** Timestamp of the worker's first successful authenticated file access. Set once, never updated. */
  firstOpenedAt: Date | null;
  /** Timestamp of the most recent successful authenticated file access. Updated on every access. */
  lastOpenedAt: Date | null;
  /** Total count of successful authenticated file accesses by the assigned worker. */
  openCount: number;
}

const PayrollDocumentSchema = new Schema<IPayrollDocument>(
  {
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
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
    matchStatus: {
      type: String,
      enum: ["manual", "matched", "unmatched"],
      required: true,
      default: "manual",
      index: true,
    },
    parsedEmployeeNumber: {
      type: String,
      required: false,
    },
    matchReason: {
      type: String,
      required: false,
    },
    deletedAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },

    // ── P1.3: Open evidence ───────────────────────────────────────────────────
    firstOpenedAt: {
      type: Date,
      required: false,
      default: null,
    },
    lastOpenedAt: {
      type: Date,
      required: false,
      default: null,
    },
    openCount: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  { timestamps: true },
);

PayrollDocumentSchema.index({ companyId: 1, workerId: 1, year: 1, month: 1 });
PayrollDocumentSchema.index({ companyId: 1, matchStatus: 1 });

const PayrollDocument = mongoose.model<IPayrollDocument>(
  "PayrollDocument",
  PayrollDocumentSchema,
);

export default PayrollDocument;
