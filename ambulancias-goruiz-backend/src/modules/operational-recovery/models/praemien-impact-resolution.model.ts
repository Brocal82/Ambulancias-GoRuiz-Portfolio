/**
 * Phase 3.4.1 — PraemienImpactResolution
 *
 * Represents the current operational resolution state for a Workday correction's
 * impact on a worker's Praemien.
 *
 * Architecture:
 *   OperationalRecoveryEvent      = immutable audit trail (WHAT happened)
 *   PraemienImpactResolution      = CURRENT operational state (WHERE we are now)
 *   MonthlyPraemie                = monthly result (NOT touched here)
 *
 * This model does NOT replace MonthlyPraemie.
 * It only answers: "What is the current operational resolution state?"
 *
 * Lifecycle:
 *   pending       → correction arrived with praemienImpact=possible, awaiting review
 *   ignored       → admin reviewed and dismissed (no recalculation needed)
 *   recalculated  → MonthlyPraemie was recalculated (Phase 3.4.2+)
 *   adjusted      → manually adjusted through the praemien admin workflow
 *   blocked       → resolution blocked (e.g., praemie period already closed/locked)
 *
 * Strict multi-tenant: companyId is always required; no null fallback.
 */
import mongoose, { Document, Schema, Types } from "mongoose";

export const PRAEMIEN_RESOLUTION_STATUS = {
  PENDING: "pending",
  IGNORED: "ignored",
  RECALCULATED: "recalculated",
  ADJUSTED: "adjusted",
  BLOCKED: "blocked",
} as const;

export type PraemienResolutionStatus =
  (typeof PRAEMIEN_RESOLUTION_STATUS)[keyof typeof PRAEMIEN_RESOLUTION_STATUS];

export const PRAEMIEN_RESOLUTION_STATUSES = Object.values(
  PRAEMIEN_RESOLUTION_STATUS,
);

/** Terminal states — a resolution in one of these cannot be resolved again. */
export const PRAEMIEN_RESOLUTION_TERMINAL_STATUSES: PraemienResolutionStatus[] =
  [
    PRAEMIEN_RESOLUTION_STATUS.IGNORED,
    PRAEMIEN_RESOLUTION_STATUS.RECALCULATED,
    PRAEMIEN_RESOLUTION_STATUS.ADJUSTED,
    PRAEMIEN_RESOLUTION_STATUS.BLOCKED,
  ];

export interface IPraemienImpactResolution extends Document {
  /** Always required — strict tenant isolation, no null. */
  companyId: Types.ObjectId;
  /** The worker whose Praemien may be affected. */
  workerId: Types.ObjectId;
  /** Calendar year of the affected period (derived from correction date). */
  year: number;
  /** Calendar month of the affected period, 1–12. */
  month: number;
  /** The WorkdaySummary that was corrected. */
  relatedWorkdaySummaryId: Types.ObjectId;
  /** The WorkdaySummaryCorrection that triggered this resolution. */
  relatedWorkdaySummaryCorrectionId: Types.ObjectId;
  /** Linked MonthlyPraemie (set when recalculated, optional otherwise). */
  relatedMonthlyPraemieId?: Types.ObjectId;
  /** Current lifecycle status. */
  status: PraemienResolutionStatus;
  /** Effective patient count before correction (optional, for audit). */
  beforeValue?: number;
  /** Effective patient count after correction (optional, for audit). */
  afterValue?: number;
  /** Computed delta = afterValue - beforeValue (optional, for audit). */
  delta?: number;
  /** Why this resolution was created (from the correction reason). */
  reason: string;
  /** Admin who resolved/ignored/adjusted this (set on terminal transition). */
  resolvedBy?: Types.ObjectId;
  /** When the terminal transition occurred. */
  resolvedAt?: Date;
  /** Linked OperationalRecoveryEvent for this resolution lifecycle event. */
  recoveryEventId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const praemienImpactResolutionSchema = new Schema<IPraemienImpactResolution>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, index: true },
    relatedWorkdaySummaryId: {
      type: Schema.Types.ObjectId,
      ref: "WorkdaySummary",
      required: true,
      index: true,
    },
    relatedWorkdaySummaryCorrectionId: {
      type: Schema.Types.ObjectId,
      ref: "WorkdaySummaryCorrection",
      required: true,
      index: true,
    },
    relatedMonthlyPraemieId: {
      type: Schema.Types.ObjectId,
      ref: "MonthlyPraemie",
      default: undefined,
    },
    status: {
      type: String,
      enum: PRAEMIEN_RESOLUTION_STATUSES,
      required: true,
      default: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      index: true,
    },
    beforeValue: { type: Number, default: undefined },
    afterValue: { type: Number, default: undefined },
    delta: { type: Number, default: undefined },
    reason: { type: String, required: true, trim: true },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    resolvedAt: { type: Date, default: undefined },
    recoveryEventId: {
      type: Schema.Types.ObjectId,
      ref: "OperationalRecoveryEvent",
      default: undefined,
    },
  },
  {
    collection: "praemien_impact_resolutions",
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

// Compound indexes for efficient querying
praemienImpactResolutionSchema.index({
  companyId: 1,
  workerId: 1,
  year: 1,
  month: 1,
  status: 1,
});
praemienImpactResolutionSchema.index({
  relatedWorkdaySummaryCorrectionId: 1,
  workerId: 1,
  status: 1,
});
praemienImpactResolutionSchema.index({
  companyId: 1,
  relatedWorkdaySummaryId: 1,
  status: 1,
});

const PraemienImpactResolution =
  mongoose.models.PraemienImpactResolution ||
  mongoose.model<IPraemienImpactResolution>(
    "PraemienImpactResolution",
    praemienImpactResolutionSchema,
  );

export default PraemienImpactResolution;
