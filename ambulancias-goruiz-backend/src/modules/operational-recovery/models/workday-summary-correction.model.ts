/**
 * Phase 3.1 — WorkdaySummaryCorrection
 *
 * Stores the *effective corrected state* of a WorkdaySummary.
 * Does NOT duplicate the full WorkdaySummary — only the fields being corrected.
 * Does NOT store trips, patient names, or raw trip bodies.
 *
 * Architecture decision:
 *   OperationalRecoveryEvent  = immutable audit trail (what happened)
 *   WorkdaySummaryCorrection  = effective corrected values (what the system should use now)
 *
 * Lifecycle:
 *   active     → the current effective correction for this summary
 *   superseded → replaced by a newer correction (kept for history)
 *   voided     → administratively cancelled (kept for history)
 */
import mongoose, { Document, Schema, Types } from "mongoose";
import {
  RECOVERY_PAYROLL_IMPACTS,
  RECOVERY_PRAEMIEN_IMPACTS,
  type PayrollImpact,
  type PraemienImpact,
} from "../constants/operational-recovery.constants";

export const CORRECTION_STATUS = {
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  VOIDED: "voided",
} as const;

export type CorrectionStatus =
  (typeof CORRECTION_STATUS)[keyof typeof CORRECTION_STATUS];

export const CORRECTION_STATUSES = Object.values(CORRECTION_STATUS);

export interface IWorkdaySummaryCorrection extends Document {
  /** The original WorkdaySummary being corrected. Immutable after creation. */
  originalSummaryId: Types.ObjectId;
  /** Always set from the admin actor's companyId — never nullable here. */
  companyId: Types.ObjectId;
  /** Denormalized from summary for efficient querying. */
  assignmentId: string;
  /** Denormalized from summary (YYYY-MM-DD). */
  date: string;
  /** Driver + medic IDs from the original summary, for cross-reference. */
  workerIds?: Types.ObjectId[];

  // ── Corrected effective values ────────────────────────────────────────────
  // Only fields explicitly corrected are stored; absent fields inherit from original.
  correctedFinalKm?: number;
  correctedTotalDienstKm?: number;
  correctedTotalEffectivePatients?: number;
  correctedTotalRealTrips?: number;

  // ── Correction metadata ───────────────────────────────────────────────────
  correctionReason: string;
  correctionNote?: string;
  correctedBy: Types.ObjectId;
  correctedAt: Date;

  // ── Impact flags ──────────────────────────────────────────────────────────
  // TODO Phase 3.4: propagate praemienImpact to monthly Praemien recalculation.
  // TODO Phase 3.4: propagate payrollImpact to payroll recalculation.
  praemienImpact: PraemienImpact;
  payrollImpact: PayrollImpact;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status: CorrectionStatus;
  /** Linked OperationalRecoveryEvent created alongside this correction. */
  recoveryEventId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const workdaySummaryCorrectionSchema = new Schema<IWorkdaySummaryCorrection>(
  {
    originalSummaryId: {
      type: Schema.Types.ObjectId,
      ref: "WorkdaySummary",
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    assignmentId: { type: String, required: true, trim: true, index: true },
    date: { type: String, required: true, trim: true, index: true },
    workerIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: undefined,
    },

    correctedFinalKm: { type: Number, default: undefined },
    correctedTotalDienstKm: { type: Number, default: undefined },
    correctedTotalEffectivePatients: { type: Number, default: undefined },
    correctedTotalRealTrips: { type: Number, default: undefined },

    correctionReason: { type: String, required: true, trim: true },
    correctionNote: { type: String, trim: true, default: undefined },
    correctedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    correctedAt: { type: Date, required: true },

    praemienImpact: {
      type: String,
      enum: RECOVERY_PRAEMIEN_IMPACTS,
      required: true,
      default: "none",
    },
    payrollImpact: {
      type: String,
      enum: RECOVERY_PAYROLL_IMPACTS,
      required: true,
      default: "none",
    },

    status: {
      type: String,
      enum: CORRECTION_STATUSES,
      required: true,
      default: CORRECTION_STATUS.ACTIVE,
      index: true,
    },
    recoveryEventId: {
      type: Schema.Types.ObjectId,
      ref: "OperationalRecoveryEvent",
      default: undefined,
    },
  },
  {
    collection: "workday_summary_corrections",
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

workdaySummaryCorrectionSchema.index({ originalSummaryId: 1, status: 1 });
workdaySummaryCorrectionSchema.index({ companyId: 1, date: 1 });

const WorkdaySummaryCorrection =
  mongoose.models.WorkdaySummaryCorrection ||
  mongoose.model<IWorkdaySummaryCorrection>(
    "WorkdaySummaryCorrection",
    workdaySummaryCorrectionSchema,
  );

export default WorkdaySummaryCorrection;
