import type { Request } from "express";
import type { AuditLogEntry, AuditOutcome, AuditEventName } from "./audit-events";

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim() !== "") {
    return forwarded.split(",")[0]?.trim();
  }
  return req.ip || undefined;
}

export function buildAuditContextFromRequest(req: Request): {
  actorUserId?: string;
  actorRole?: string;
  tenantCompanyId?: string;
  httpMethod: string;
  path: string;
  ip?: string;
  userAgent?: string;
} {
  return {
    actorUserId: req.userId,
    actorRole: req.userRole ?? req.user?.role,
    tenantCompanyId: req.companyId,
    httpMethod: req.method,
    path: req.originalUrl || req.path,
    ip: getClientIp(req),
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined,
  };
}

export function emitAuditLog(
  event: AuditEventName,
  outcome: AuditOutcome,
  data: Omit<AuditLogEntry, "event" | "outcome" | "at"> = {},
): void {
  const entry: AuditLogEntry = {
    event,
    outcome,
    at: new Date().toISOString(),
    ...data,
  };
  console.info("[audit]", JSON.stringify(entry));
}

export function emitSecurityAlert(
  type: string,
  data: Record<string, unknown>,
): void {
  console.warn(
    "[security-alert]",
    JSON.stringify({
      type,
      at: new Date().toISOString(),
      ...data,
    }),
  );
}
