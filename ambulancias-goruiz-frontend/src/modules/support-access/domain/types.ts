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

export type SecurityAuditLogRow = {
  _id: string;
  event: string;
  outcome: "success" | "denied" | "error";
  actorUserId?: string;
  tenantCompanyId?: string;
  resourceType?: string;
  resourceId?: string;
  reason?: string;
  at: string;
};

export type SecurityAuditLogsResponse = {
  total: number;
  rows: SecurityAuditLogRow[];
};

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
