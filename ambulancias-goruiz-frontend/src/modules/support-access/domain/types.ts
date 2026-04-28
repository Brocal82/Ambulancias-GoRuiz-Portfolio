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
