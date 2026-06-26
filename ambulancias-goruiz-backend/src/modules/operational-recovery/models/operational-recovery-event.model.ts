import mongoose, { Document, Schema, Types } from "mongoose";
import {
  RECOVERY_ACTION_TYPES,
  RECOVERY_ENTITY_TYPES,
  RECOVERY_PAYROLL_IMPACTS,
  RECOVERY_PRAEMIEN_IMPACTS,
  RECOVERY_SEVERITIES,
  RECOVERY_STATUSES,
  type PayrollImpact,
  type PraemienImpact,
  type RecoveryActionType,
  type RecoveryEntityType,
  type RecoverySeverity,
  type RecoveryStatus,
} from "../constants/operational-recovery.constants";

export interface IOperationalRecoveryEvent extends Document {
  companyId: Types.ObjectId;
  moduleKey: string;
  entityType: RecoveryEntityType;
  entityId: string;
  entityLabel?: string;
  action: RecoveryActionType;
  actorUserId: Types.ObjectId;
  actorRole: string;
  reason?: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
  severity: RecoverySeverity;
  relatedWorkerId?: Types.ObjectId;
  relatedDate?: Date;
  relatedAssignmentId?: string;
  relatedDienstId?: Types.ObjectId;
  relatedWorkdaySummaryId?: Types.ObjectId;
  relatedTripId?: Types.ObjectId;
  payrollImpact: PayrollImpact;
  praemienImpact: PraemienImpact;
  status: RecoveryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const operationalRecoveryEventSchema = new Schema<IOperationalRecoveryEvent>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    moduleKey: { type: String, required: true, trim: true, index: true },
    entityType: {
      type: String,
      enum: RECOVERY_ENTITY_TYPES,
      required: true,
      index: true,
    },
    entityId: { type: String, required: true, trim: true, index: true },
    entityLabel: { type: String, trim: true },
    action: {
      type: String,
      enum: RECOVERY_ACTION_TYPES,
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    beforeSummary: { type: Schema.Types.Mixed },
    afterSummary: { type: Schema.Types.Mixed },
    changedFields: { type: [String], default: undefined },
    metadata: { type: Schema.Types.Mixed },
    severity: {
      type: String,
      enum: RECOVERY_SEVERITIES,
      default: "info",
      index: true,
    },
    relatedWorkerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    relatedDate: { type: Date, index: true },
    relatedAssignmentId: { type: String, trim: true },
    relatedDienstId: { type: Schema.Types.ObjectId, ref: "Dienst", index: true },
    relatedWorkdaySummaryId: {
      type: Schema.Types.ObjectId,
      ref: "WorkdaySummary",
      index: true,
    },
    relatedTripId: { type: Schema.Types.ObjectId, ref: "Trip", index: true },
    payrollImpact: {
      type: String,
      enum: RECOVERY_PAYROLL_IMPACTS,
      default: "none",
    },
    praemienImpact: {
      type: String,
      enum: RECOVERY_PRAEMIEN_IMPACTS,
      default: "none",
    },
    status: {
      type: String,
      enum: RECOVERY_STATUSES,
      default: "recorded",
      index: true,
    },
  },
  {
    collection: "operational_recovery_events",
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

operationalRecoveryEventSchema.index({ companyId: 1, entityType: 1, entityId: 1, createdAt: -1 });

const immutableMutationError = new Error(
  "OperationalRecoveryEvent is append-only and immutable",
);
const blockMutations = function blockMutations(next: (err?: Error) => void): void {
  next(immutableMutationError);
};

operationalRecoveryEventSchema.pre("updateOne", blockMutations);
operationalRecoveryEventSchema.pre("updateMany", blockMutations);
operationalRecoveryEventSchema.pre("findOneAndUpdate", blockMutations);
operationalRecoveryEventSchema.pre("replaceOne", blockMutations);
operationalRecoveryEventSchema.pre("findOneAndReplace", blockMutations);
operationalRecoveryEventSchema.pre("deleteOne", blockMutations);
operationalRecoveryEventSchema.pre("deleteMany", blockMutations);
operationalRecoveryEventSchema.pre("findOneAndDelete", blockMutations);

const OperationalRecoveryEvent =
  mongoose.models.OperationalRecoveryEvent ||
  mongoose.model<IOperationalRecoveryEvent>(
    "OperationalRecoveryEvent",
    operationalRecoveryEventSchema,
  );

export default OperationalRecoveryEvent;
