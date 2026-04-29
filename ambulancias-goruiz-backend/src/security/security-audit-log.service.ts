import SecurityAuditLog from "./models/security-audit-log.model";
import type { AuditEventName, AuditOutcome } from "./audit-events";

export type AuditLogQuery = {
  hours?: number;
  event?: AuditEventName;
  outcome?: AuditOutcome;
  actorUserId?: string;
  tenantCompanyId?: string;
  limit?: number;
};

export async function querySecurityAuditLogs(query: AuditLogQuery): Promise<{
  total: number;
  rows: Array<Record<string, unknown>>;
}> {
  const safeHours = Number.isFinite(query.hours)
    ? Math.max(1, Math.min(168, Math.floor(Number(query.hours))))
    : 24;
  const safeLimit = Number.isFinite(query.limit)
    ? Math.max(1, Math.min(200, Math.floor(Number(query.limit))))
    : 50;

  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const filter: Record<string, unknown> = {
    at: { $gte: since },
  };

  if (query.event) filter.event = query.event;
  if (query.outcome) filter.outcome = query.outcome;
  if (query.actorUserId) filter.actorUserId = query.actorUserId;
  if (query.tenantCompanyId) filter.tenantCompanyId = query.tenantCompanyId;

  const [total, rows] = await Promise.all([
    SecurityAuditLog.countDocuments(filter),
    SecurityAuditLog.find(filter).sort({ at: -1 }).limit(safeLimit).lean(),
  ]);

  return { total, rows: rows as Array<Record<string, unknown>> };
}
