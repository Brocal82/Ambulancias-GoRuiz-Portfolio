import mongoose from "mongoose";
import { env } from "../config/env";
import { AUDIT_EVENT } from "./audit-events";
import SecurityAuditLog from "./models/security-audit-log.model";
import { buildSecurityMonitoringSnapshot } from "./security-monitoring";

export type SecurityOperationalAlert = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type SecurityMonitoringOperationalHealth = {
  dbStatus: "ok" | "down";
  monitoringEnabled: boolean;
  monitoringCron: string;
  lastDailyReportAt: string | null;
  staleDailyReport: boolean;
  alerts: SecurityOperationalAlert[];
};

const MAX_DAILY_REPORT_AGE_HOURS = 30;

export async function buildSecurityMonitoringOperationalHealth(
  now = new Date(),
): Promise<SecurityMonitoringOperationalHealth> {
  const dbStatus = mongoose.connection.readyState === 1 ? "ok" : "down";

  const lastDailyReport = await SecurityAuditLog.findOne({
    event: AUDIT_EVENT.SECURITY_DAILY_MONITORING_REPORTED,
    outcome: "success",
  })
    .sort({ at: -1 })
    .select("at")
    .lean();

  const lastDailyReportAt =
    lastDailyReport?.at instanceof Date
      ? lastDailyReport.at.toISOString()
      : lastDailyReport?.at
        ? new Date(lastDailyReport.at as any).toISOString()
        : null;

  const staleDailyReport =
    !lastDailyReportAt ||
    now.getTime() - new Date(lastDailyReportAt).getTime() >
      MAX_DAILY_REPORT_AGE_HOURS * 60 * 60 * 1000;

  const alerts: SecurityOperationalAlert[] = [];

  if (dbStatus !== "ok") {
    alerts.push({
      code: "db_down",
      severity: "critical",
      message: "Database connection is not healthy.",
    });
  }

  if (!env.SECURITY_MONITORING_ENABLED) {
    alerts.push({
      code: "monitoring_disabled",
      severity: "critical",
      message: "Security monitoring cron is disabled.",
    });
  }

  if (staleDailyReport) {
    alerts.push({
      code: "daily_report_stale",
      severity: "warning",
      message: "No recent daily security monitoring report was detected.",
    });
  }

  const snapshot24h = await buildSecurityMonitoringSnapshot(24, now);
  if (snapshot24h.supportAccess.denied >= env.SECURITY_MONITORING_DENIED_THRESHOLD) {
    alerts.push({
      code: "denied_threshold_exceeded",
      severity: "warning",
      message: "Denied support-access requests exceeded configured threshold in last 24h.",
    });
  }
  if (snapshot24h.supportAccess.offHoursFinalApprovals > 0) {
    alerts.push({
      code: "off_hours_approvals_detected",
      severity: "warning",
      message: "Final approvals outside business hours were detected in last 24h.",
    });
  }

  return {
    dbStatus,
    monitoringEnabled: env.SECURITY_MONITORING_ENABLED,
    monitoringCron: env.SECURITY_MONITORING_CRON,
    lastDailyReportAt,
    staleDailyReport,
    alerts,
  };
}
