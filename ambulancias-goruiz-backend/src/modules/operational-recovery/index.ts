export {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ACTION_TYPES,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_ENTITY_TYPES,
  RECOVERY_PAYROLL_IMPACT,
  RECOVERY_PAYROLL_IMPACTS,
  RECOVERY_PRAEMIEN_IMPACT,
  RECOVERY_PRAEMIEN_IMPACTS,
  RECOVERY_SEVERITY,
  RECOVERY_SEVERITIES,
  RECOVERY_STATUS,
  RECOVERY_STATUSES,
} from "./constants/operational-recovery.constants";
export type {
  PayrollImpact,
  PraemienImpact,
  RecoveryActionType,
  RecoveryEntityType,
  RecoverySeverity,
  RecoveryStatus,
} from "./constants/operational-recovery.constants";
export { default as OperationalRecoveryEvent } from "./models/operational-recovery-event.model";
export type { IOperationalRecoveryEvent } from "./models/operational-recovery-event.model";
export {
  assertRecoveryEventTenant,
  OperationalRecoveryError,
  recordRecoveryEvent,
} from "./services/operational-recovery.service";
export type { RecordRecoveryEventInput } from "./types/operational-recovery.types";
export {
  FORBIDDEN_RECOVERY_KEYS,
  sanitizeRecoveryMetadata,
  sanitizeRecoverySnapshot,
} from "./utils/sanitize-recovery-snapshot.helper";
export { detectAbsenceInconsistencies } from "./services/absence-cleanup-detection.service";
export { repairAbsenceInconsistency } from "./services/absence-cleanup-repair.service";
export type {
  AbsenceInconsistency,
  AbsenceType,
  DetectAbsenceInconsistenciesInput,
  RepairAbsenceInconsistencyInput,
  RepairResult,
} from "./types/absence-cleanup.types";

// Phase 3.1 — Workday Recovery
export {
  default as WorkdaySummaryCorrection,
  CORRECTION_STATUS,
  CORRECTION_STATUSES,
} from "./models/workday-summary-correction.model";
export type {
  IWorkdaySummaryCorrection,
  CorrectionStatus,
} from "./models/workday-summary-correction.model";
export {
  createWorkdaySummaryCorrection,
  getEffectiveWorkdaySummary,
} from "./services/workday-recovery.service";
export type {
  CreateWorkdaySummaryCorrectionInput,
  CreateWorkdaySummaryCorrectionResult,
  EffectiveWorkdaySummary,
  GetEffectiveWorkdaySummaryInput,
  OriginalWorkdayValues,
} from "./types/workday-recovery.types";

// Phase 3.4.1 — Praemien Impact Resolution
export {
  default as PraemienImpactResolution,
  PRAEMIEN_RESOLUTION_STATUS,
  PRAEMIEN_RESOLUTION_STATUSES,
  PRAEMIEN_RESOLUTION_TERMINAL_STATUSES,
} from "./models/praemien-impact-resolution.model";
export type {
  IPraemienImpactResolution,
  PraemienResolutionStatus,
} from "./models/praemien-impact-resolution.model";
export {
  createPraemienImpactResolution,
  getActivePraemienImpact,
  resolvePraemienImpact,
  parseDateToYearMonth,
} from "./services/praemien-impact-resolution.service";
export type {
  CreatePraemienImpactResolutionInput,
  CreatePraemienImpactResolutionResult,
  GetActivePraemienImpactInput,
  ResolvePraemienImpactInput,
  ResolvePraemienImpactResult,
  ResolvableStatus,
} from "./types/praemien-impact.types";
