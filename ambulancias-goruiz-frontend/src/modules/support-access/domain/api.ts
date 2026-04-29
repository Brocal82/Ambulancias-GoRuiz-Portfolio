import axios from "../../../api/axios";
import type {
  SecurityAuditLogsResponse,
  SecurityMonitoringOperationalHealth,
  SecurityMonitoringSnapshot,
  SecurityMonthlyReviewSnapshot,
  SecurityTenantRiskResponse,
} from "./types";

export async function getSecurityMonitoringSummary(
  hours = 24,
): Promise<SecurityMonitoringSnapshot> {
  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(168, Math.floor(hours))) : 24;
  const res = await axios.get<SecurityMonitoringSnapshot>(
    `/support-access/monitoring/daily-summary?hours=${safeHours}`,
  );
  return res.data;
}

export async function getSecurityAuditLogs(params: {
  hours: number;
  limit?: number;
  outcome?: "success" | "denied" | "error" | "";
  event?: string;
  actorUserId?: string;
  tenantCompanyId?: string;
}): Promise<SecurityAuditLogsResponse> {
  const safeHours = Number.isFinite(params.hours)
    ? Math.max(1, Math.min(168, Math.floor(params.hours)))
    : 24;
  const safeLimit = Number.isFinite(params.limit)
    ? Math.max(1, Math.min(200, Math.floor(params.limit as number)))
    : 50;

  const search = new URLSearchParams();
  search.set("hours", String(safeHours));
  search.set("limit", String(safeLimit));
  if (params.outcome) search.set("outcome", params.outcome);
  if (params.event?.trim()) search.set("event", params.event.trim());
  if (params.actorUserId?.trim()) search.set("actorUserId", params.actorUserId.trim());
  if (params.tenantCompanyId?.trim()) search.set("tenantCompanyId", params.tenantCompanyId.trim());

  const res = await axios.get<SecurityAuditLogsResponse>(
    `/support-access/monitoring/audit-logs?${search.toString()}`,
  );
  return res.data;
}

export async function getSecurityMonitoringOperationalHealth(): Promise<SecurityMonitoringOperationalHealth> {
  const res = await axios.get<SecurityMonitoringOperationalHealth>(
    "/support-access/monitoring/health",
  );
  return res.data;
}

export async function getSecurityTenantRisk(params: {
  hours: number;
  limit?: number;
}): Promise<SecurityTenantRiskResponse> {
  const safeHours = Number.isFinite(params.hours)
    ? Math.max(1, Math.min(168, Math.floor(params.hours)))
    : 24;
  const safeLimit = Number.isFinite(params.limit)
    ? Math.max(1, Math.min(100, Math.floor(params.limit as number)))
    : 20;
  const res = await axios.get<SecurityTenantRiskResponse>(
    `/support-access/monitoring/tenant-risk?hours=${safeHours}&limit=${safeLimit}`,
  );
  return res.data;
}

export async function getSecurityMonthlyReview(hours = 24 * 30): Promise<SecurityMonthlyReviewSnapshot> {
  const safeHours = Number.isFinite(hours) ? Math.max(24, Math.min(24 * 31, Math.floor(hours))) : 24 * 30;
  const res = await axios.get<SecurityMonthlyReviewSnapshot>(
    `/support-access/monitoring/monthly-review?hours=${safeHours}`,
  );
  return res.data;
}
