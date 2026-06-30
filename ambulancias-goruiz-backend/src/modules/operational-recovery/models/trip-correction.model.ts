/**
 * Phase 4.1 — TripCorrection
 *
 * Stores the *effective corrected state* of a Trip (or a synthetic forgotten trip).
 * Does NOT duplicate the full Trip document — only operational non-PII fields.
 * Does NOT store patient names, addresses, phone numbers, or raw reports.
 *
 * Architecture decision:
 *   OperationalRecoveryEvent = immutable audit timeline (what happened)
 *   TripCorrection           = effective corrected state (what the system should use now)
 *
 * Lifecycle status:
 *   active     → current effective correction for this trip/context
 *   superseded → replaced by a newer correction (kept for history)
 *   voided     → administratively cancelled (kept for history)
 */
import mongoose, { Document, Schema, Types } from "mongoose";
import {
  RECOVERY_PRAEMIEN_IMPACTS,
  type PraemienImpact,
} from "../constants/operational-recovery.constants";

export const TRIP_CORRECTION_TYPE = {
  CORRECT: "correct",
  VOID: "void",
  REPLACE: "replace",
  ADD_FORGOTTEN: "add_forgotten",
} as const;

export type TripCorrectionType =
  (typeof TRIP_CORRECTION_TYPE)[keyof typeof TRIP_CORRECTION_TYPE];

export const TRIP_CORRECTION_TYPES = Object.values(TRIP_CORRECTION_TYPE);

export const TRIP_CORRECTION_STATUS = {
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  VOIDED: "voided",
} as const;

export type TripCorrectionStatus =
  (typeof TRIP_CORRECTION_STATUS)[keyof typeof TRIP_CORRECTION_STATUS];

export const TRIP_CORRECTION_STATUSES = Object.values(TRIP_CORRECTION_STATUS);

export interface ITripCorrection extends Document {
  companyId: Types.ObjectId;
  correctionType: TripCorrectionType;
  status: TripCorrectionStatus;

  /** Original Trip being corrected. Absent for add_forgotten. */
  originalTripId?: Types.ObjectId;
  /** Future use for replace corrections. */
  replacementTripId?: Types.ObjectId;

  assignmentId: string;
  date: string;
  workerIds?: Types.ObjectId[];

  relatedWorkdaySummaryId?: Types.ObjectId;
  relatedWorkdaySummaryCorrectionId?: Types.ObjectId;

  // ── Effective operational fields (non-PII) ──────────────────────────────────
  effectiveCountsTrip?: 0 | 1;
  effectiveWasCancelled?: boolean;
  effectiveCancelledAtPickup?: boolean;
  effectiveKmStart?: number;
  effectiveKmEnd?: number;
  effectiveTimeWarning?: string;
  effectiveTimeAtHome?: string;
  effectiveTimePickup?: string;
  effectiveTimeArrival?: string;
  effectiveTimeEnd?: string;

  reason: string;
  note?: string;
  actorUserId: Types.ObjectId;
  actorRole: string;

  praemienImpact: PraemienImpact;
  recoveryEventId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const tripCorrectionSchema = new Schema<ITripCorrection>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    correctionType: {
      type: String,
      enum: TRIP_CORRECTION_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TRIP_CORRECTION_STATUSES,
      required: true,
      default: TRIP_CORRECTION_STATUS.ACTIVE,
      index: true,
    },

    originalTripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      default: undefined,
      index: true,
    },
    replacementTripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      default: undefined,
    },

    assignmentId: { type: String, required: true, trim: true, index: true },
    date: { type: String, required: true, trim: true, index: true },
    workerIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: undefined,
    },

    relatedWorkdaySummaryId: {
      type: Schema.Types.ObjectId,
      ref: "WorkdaySummary",
      default: undefined,
    },
    relatedWorkdaySummaryCorrectionId: {
      type: Schema.Types.ObjectId,
      ref: "WorkdaySummaryCorrection",
      default: undefined,
    },

    effectiveCountsTrip: { type: Number, enum: [0, 1], default: undefined },
    effectiveWasCancelled: { type: Boolean, default: undefined },
    effectiveCancelledAtPickup: { type: Boolean, default: undefined },
    effectiveKmStart: { type: Number, default: undefined },
    effectiveKmEnd: { type: Number, default: undefined },
    effectiveTimeWarning: { type: String, trim: true, default: undefined },
    effectiveTimeAtHome: { type: String, trim: true, default: undefined },
    effectiveTimePickup: { type: String, trim: true, default: undefined },
    effectiveTimeArrival: { type: String, trim: true, default: undefined },
    effectiveTimeEnd: { type: String, trim: true, default: undefined },

    reason: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: undefined },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: { type: String, required: true, trim: true },

    praemienImpact: {
      type: String,
      enum: RECOVERY_PRAEMIEN_IMPACTS,
      required: true,
      default: "none",
    },
    recoveryEventId: {
      type: Schema.Types.ObjectId,
      ref: "OperationalRecoveryEvent",
      default: undefined,
    },
  },
  {
    collection: "trip_corrections",
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

tripCorrectionSchema.index({ originalTripId: 1, status: 1 });
tripCorrectionSchema.index({ companyId: 1, assignmentId: 1, date: 1 });
tripCorrectionSchema.index({
  companyId: 1,
  correctionType: 1,
  assignmentId: 1,
  date: 1,
  status: 1,
});

const TripCorrection =
  mongoose.models.TripCorrection ||
  mongoose.model<ITripCorrection>("TripCorrection", tripCorrectionSchema);

export default TripCorrection;
