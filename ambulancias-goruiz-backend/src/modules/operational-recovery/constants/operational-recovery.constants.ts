/**
 * Shared enums for Operational Recovery events.
 * Append-only audit trail for admin recovery actions across modules.
 */

export const RECOVERY_ENTITY_TYPE = {
  TRIP: "TRIP",
  WORKDAY_SUMMARY: "WORKDAY_SUMMARY",
  DIENST_ASSIGNMENT: "DIENST_ASSIGNMENT",
  PRAEMIE: "PRAEMIE",
  PAYROLL: "PAYROLL",
} as const;

export type RecoveryEntityType =
  (typeof RECOVERY_ENTITY_TYPE)[keyof typeof RECOVERY_ENTITY_TYPE];

export const RECOVERY_ACTION_TYPE = {
  CORRECTED: "CORRECTED",
  VOIDED: "VOIDED",
  REOPENED: "REOPENED",
  REPLACED: "REPLACED",
  RERUN_CLEANUP: "RERUN_CLEANUP",
  MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
  SYSTEM_RECONCILED: "SYSTEM_RECONCILED",
  ADMIN_OVERRIDE: "ADMIN_OVERRIDE",
  FAILED_RECOVERY_ATTEMPT: "FAILED_RECOVERY_ATTEMPT",
  // Phase 3.4 — Praemien Impact Resolution lifecycle events
  PRAEMIEN_RESOLUTION_CREATED: "PRAEMIEN_RESOLUTION_CREATED",
  PRAEMIEN_RESOLUTION_COALESCED: "PRAEMIEN_RESOLUTION_COALESCED",
  PRAEMIEN_RESOLUTION_IGNORED: "PRAEMIEN_RESOLUTION_IGNORED",
  PRAEMIEN_RESOLUTION_RESOLVED: "PRAEMIEN_RESOLUTION_RESOLVED",
  PRAEMIEN_RESOLUTION_ADJUSTED: "PRAEMIEN_RESOLUTION_ADJUSTED",
} as const;

export type RecoveryActionType =
  (typeof RECOVERY_ACTION_TYPE)[keyof typeof RECOVERY_ACTION_TYPE];

export const RECOVERY_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export type RecoverySeverity =
  (typeof RECOVERY_SEVERITY)[keyof typeof RECOVERY_SEVERITY];

export const RECOVERY_STATUS = {
  RECORDED: "recorded",
} as const;

export type RecoveryStatus =
  (typeof RECOVERY_STATUS)[keyof typeof RECOVERY_STATUS];

export const RECOVERY_PAYROLL_IMPACT = {
  NONE: "none",
  POSSIBLE: "possible",
  RECALCULATED: "recalculated",
  BLOCKED: "blocked",
} as const;

export type PayrollImpact =
  (typeof RECOVERY_PAYROLL_IMPACT)[keyof typeof RECOVERY_PAYROLL_IMPACT];

export const RECOVERY_PRAEMIEN_IMPACT = {
  NONE: "none",
  POSSIBLE: "possible",
  RECALCULATED: "recalculated",
  BLOCKED: "blocked",
} as const;

export type PraemienImpact =
  (typeof RECOVERY_PRAEMIEN_IMPACT)[keyof typeof RECOVERY_PRAEMIEN_IMPACT];

export const RECOVERY_ENTITY_TYPES = Object.values(RECOVERY_ENTITY_TYPE);
export const RECOVERY_ACTION_TYPES = Object.values(RECOVERY_ACTION_TYPE);
export const RECOVERY_SEVERITIES = Object.values(RECOVERY_SEVERITY);
export const RECOVERY_STATUSES = Object.values(RECOVERY_STATUS);
export const RECOVERY_PAYROLL_IMPACTS = Object.values(RECOVERY_PAYROLL_IMPACT);
export const RECOVERY_PRAEMIEN_IMPACTS = Object.values(RECOVERY_PRAEMIEN_IMPACT);
