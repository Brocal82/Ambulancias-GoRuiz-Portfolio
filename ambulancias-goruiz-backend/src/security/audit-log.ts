import type { Request } from "express";
import type { AuditLogEntry, AuditOutcome, AuditEventName } from "./audit-events";
import SecurityAuditLog from "./models/security-audit-log.model";
import { env } from "../config/env";

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

function buildAuditLogEntry(
  event: AuditEventName,
  outcome: AuditOutcome,
  data: Omit<AuditLogEntry, "event" | "outcome" | "at"> = {},
  at = new Date(),
): AuditLogEntry {
  return {
    event,
    outcome,
    at: at.toISOString(),
    ...data,
  };
}

export function emitAuditLog(
  event: AuditEventName,
  outcome: AuditOutcome,
  data: Omit<AuditLogEntry, "event" | "outcome" | "at"> = {},
): void {
  const entry = buildAuditLogEntry(event, outcome, data);
  console.info("[audit]", JSON.stringify(entry));
  void SecurityAuditLog.create({
    ...entry,
    at: new Date(entry.at),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[audit-persistence-error]", message);
  });
}

/** Persist audit log before returning — for cron jobs that update health checks. */
export async function emitAuditLogAsync(
  event: AuditEventName,
  outcome: AuditOutcome,
  data: Omit<AuditLogEntry, "event" | "outcome" | "at"> = {},
  at = new Date(),
): Promise<void> {
  const entry = buildAuditLogEntry(event, outcome, data, at);
  console.info("[audit]", JSON.stringify(entry));
  try {
    await SecurityAuditLog.create({
      ...entry,
      at: new Date(entry.at),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[audit-persistence-error]", message);
    throw error;
  }
}

export function emitSecurityAlert(
  type: string,
  data: Record<string, unknown>,
): void {
  const payload = {
    type,
    at: new Date().toISOString(),
    ...data,
  };
  console.warn("[security-alert]", JSON.stringify(payload));

  const webhookUrl = env.SECURITY_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  void fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[security-alert-webhook-error]", message);
  });
}
