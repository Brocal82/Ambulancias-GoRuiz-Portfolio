export const AUDIT_EVENT = {
  AUTH_LOGIN_SUCCEEDED: "auth.login_succeeded",
  AUTH_LOGIN_FAILED: "auth.login_failed",
  COMPANY_CREATED: "company.created",
  COMPANY_UPDATED: "company.updated",
  COMPANY_DELETED: "company.deleted",
  FILE_ACCESS_GRANTED: "file.access_granted",
  FILE_ACCESS_DENIED: "file.access_denied",
  SUPPORT_ACCESS_REQUESTED: "support_access.requested",
  SUPPORT_ACCESS_APPROVED: "support_access.approved",
  SUPPORT_ACCESS_DENIED: "support_access.denied",
  SUPPORT_ACCESS_REVOKED: "support_access.revoked",
  SUPPORT_ACCESS_EXPIRED: "support_access.expired",
} as const;

export type AuditEventName = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

export type AuditOutcome = "success" | "denied" | "error";

export type AuditLogEntry = {
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
  at: string;
  meta?: Record<string, unknown>;
};
