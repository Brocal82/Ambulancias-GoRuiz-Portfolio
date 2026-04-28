import mongoose, { Document, Schema } from "mongoose";
import { env } from "../../config/env";
import type { AuditEventName, AuditOutcome } from "../audit-events";

export interface ISecurityAuditLog extends Document {
  event: AuditEventName;
  outcome: AuditOutcome;
  actorUserId?: string;
  actorRole?: string;
  tenantCompanyId?: string;
  resourceType?: string;
  resourceId?: string;
  httpMethod?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  reason?: string;
  at: Date;
  meta?: Record<string, unknown>;
}

const securityAuditLogSchema = new Schema<ISecurityAuditLog>(
  {
    event: { type: String, required: true, index: true },
    outcome: { type: String, enum: ["success", "denied", "error"], required: true, index: true },
    actorUserId: { type: String, index: true },
    actorRole: { type: String },
    tenantCompanyId: { type: String, index: true },
    resourceType: { type: String },
    resourceId: { type: String },
    httpMethod: { type: String },
    path: { type: String },
    statusCode: { type: Number },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    reason: { type: String },
    at: { type: Date, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  {
    collection: "security_audit_logs",
    versionKey: false,
    strict: true,
  },
);

securityAuditLogSchema.index(
  { at: 1 },
  { expireAfterSeconds: env.SECURITY_AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 },
);

const immutableMutationError = new Error("SecurityAuditLog is append-only and immutable");
const blockMutations = function blockMutations(next: (err?: Error) => void): void {
  next(immutableMutationError);
};

securityAuditLogSchema.pre("updateOne", blockMutations);
securityAuditLogSchema.pre("updateMany", blockMutations);
securityAuditLogSchema.pre("findOneAndUpdate", blockMutations);
securityAuditLogSchema.pre("replaceOne", blockMutations);
securityAuditLogSchema.pre("findOneAndReplace", blockMutations);
securityAuditLogSchema.pre("deleteOne", blockMutations);
securityAuditLogSchema.pre("deleteMany", blockMutations);
securityAuditLogSchema.pre("findOneAndDelete", blockMutations);

const SecurityAuditLog =
  mongoose.models.SecurityAuditLog ||
  mongoose.model<ISecurityAuditLog>("SecurityAuditLog", securityAuditLogSchema);

export default SecurityAuditLog;
