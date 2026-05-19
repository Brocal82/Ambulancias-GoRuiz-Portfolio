import { env } from "../config/env";
import SupportAccessRequest from "../modules/support-access/models/support-access-request.model";
import { AUDIT_EVENT } from "./audit-events";
import { emitAuditLogAsync, emitSecurityAlert } from "./audit-log";

export type SupportAccessDailySummary = {
  since: string;
  until: string;
  requested: number;
  denied: number;
  approvalRecorded: number;
  approvedFinal: number;
  revoked: number;
  expired: number;
  offHoursFinalApprovals: number;
};

export type SecurityMonitoringSnapshot = {
  generatedAt: string;
  windowHours: number;
  deniedThreshold: number;
  supportAccess: SupportAccessDailySummary;
};

function isOffHours(date: Date): boolean {
  const hour = date.getHours();
  return hour < 7 || hour >= 20;
}

export async function buildSupportAccessDailySummary(
  now = new Date(),
): Promise<SupportAccessDailySummary> {
  return buildSupportAccessSummaryForHours(24, now);
}

export async function buildSupportAccessSummaryForHours(
  hours: number,
  now = new Date(),
): Promise<SupportAccessDailySummary> {
  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(168, Math.floor(hours))) : 24;
  const since = new Date(now.getTime() - safeHours * 60 * 60 * 1000);

  const [requested, denied, revoked, expired, approvalFlows] = await Promise.all([
    SupportAccessRequest.countDocuments({ createdAt: { $gte: since, $lte: now } }),
    SupportAccessRequest.countDocuments({
      status: "denied",
      reviewedAt: { $gte: since, $lte: now },
    }),
    SupportAccessRequest.countDocuments({
      status: "revoked",
      revokedAt: { $gte: since, $lte: now },
    }),
    SupportAccessRequest.countDocuments({
      status: "expired",
      expiresAt: { $gte: since, $lte: now },
    }),
    SupportAccessRequest.find({ reviewedAt: { $gte: since, $lte: now } })
      .select("approvalsCount approvalsRequired reviewedAt status")
      .lean(),
  ]);

  let approvalRecorded = 0;
  let approvedFinal = 0;
  let offHoursFinalApprovals = 0;

  for (const row of approvalFlows) {
    const approvalsCount = Number((row as any).approvalsCount ?? 0);
    const approvalsRequired = Number((row as any).approvalsRequired ?? 2);
    const reviewedAt = (row as any).reviewedAt instanceof Date
      ? ((row as any).reviewedAt as Date)
      : new Date((row as any).reviewedAt);
    if (approvalsCount > 0 && approvalsCount < approvalsRequired) {
      approvalRecorded += 1;
    }
    if (String((row as any).status) === "approved" && approvalsCount >= approvalsRequired) {
      approvedFinal += 1;
      if (!Number.isNaN(reviewedAt.getTime()) && isOffHours(reviewedAt)) {
        offHoursFinalApprovals += 1;
      }
    }
  }

  return {
    since: since.toISOString(),
    until: now.toISOString(),
    requested,
    denied,
    approvalRecorded,
    approvedFinal,
    revoked,
    expired,
    offHoursFinalApprovals,
  };
}

export async function buildSecurityMonitoringSnapshot(
  hours = 24,
  now = new Date(),
): Promise<SecurityMonitoringSnapshot> {
  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(168, Math.floor(hours))) : 24;
  const supportAccess = await buildSupportAccessSummaryForHours(safeHours, now);
  return {
    generatedAt: now.toISOString(),
    windowHours: safeHours,
    deniedThreshold: env.SECURITY_MONITORING_DENIED_THRESHOLD,
    supportAccess,
  };
}

export async function emitDailySecurityMonitoringReport(now = new Date()): Promise<void> {
  const snapshot = await buildSecurityMonitoringSnapshot(24, now);
  const summary = snapshot.supportAccess;
  await emitAuditLogAsync(
    AUDIT_EVENT.SECURITY_DAILY_MONITORING_REPORTED,
    "success",
    {
      resourceType: "security_monitoring",
      meta: {
        windowHours: snapshot.windowHours,
        supportAccess: snapshot.supportAccess,
      },
    },
    now,
  );

  if (summary.denied >= env.SECURITY_MONITORING_DENIED_THRESHOLD) {
    emitSecurityAlert("security_monitoring_denied_threshold_exceeded", {
      denied: summary.denied,
      threshold: env.SECURITY_MONITORING_DENIED_THRESHOLD,
      since: summary.since,
      until: summary.until,
    });
  }
  if (summary.offHoursFinalApprovals > 0) {
    emitSecurityAlert("security_monitoring_off_hours_approvals_detected", {
      offHoursFinalApprovals: summary.offHoursFinalApprovals,
      since: summary.since,
      until: summary.until,
    });
  }
}
