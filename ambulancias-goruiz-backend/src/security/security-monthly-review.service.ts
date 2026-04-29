import { env } from "../config/env";
import { buildSupportAccessSummaryForHours } from "./security-monitoring";

export type SecurityMonthlyReviewSnapshot = {
  generatedAt: string;
  windowHours: number;
  metrics: {
    requested: number;
    approvedFinal: number;
    denied: number;
    revoked: number;
    expired: number;
    offHoursFinalApprovals: number;
  };
  checks: {
    deniedSpike: boolean;
    offHoursApprovalsDetected: boolean;
  };
  overallStatus: "green" | "yellow" | "red";
};

export async function buildSecurityMonthlyReviewSnapshot(
  hours = 24 * 30,
  now = new Date(),
): Promise<SecurityMonthlyReviewSnapshot> {
  const safeHours = Number.isFinite(hours) ? Math.max(24, Math.min(24 * 31, Math.floor(hours))) : 24 * 30;
  const summary = await buildSupportAccessSummaryForHours(safeHours, now);

  const deniedSpike = summary.denied >= env.SECURITY_MONITORING_DENIED_THRESHOLD;
  const offHoursApprovalsDetected = summary.offHoursFinalApprovals > 0;

  const overallStatus: SecurityMonthlyReviewSnapshot["overallStatus"] =
    deniedSpike && offHoursApprovalsDetected
      ? "red"
      : deniedSpike || offHoursApprovalsDetected
        ? "yellow"
        : "green";

  return {
    generatedAt: now.toISOString(),
    windowHours: safeHours,
    metrics: {
      requested: summary.requested,
      approvedFinal: summary.approvedFinal,
      denied: summary.denied,
      revoked: summary.revoked,
      expired: summary.expired,
      offHoursFinalApprovals: summary.offHoursFinalApprovals,
    },
    checks: {
      deniedSpike,
      offHoursApprovalsDetected,
    },
    overallStatus,
  };
}
