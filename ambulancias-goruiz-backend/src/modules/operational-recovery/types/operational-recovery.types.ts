import type {
  PayrollImpact,
  PraemienImpact,
  RecoveryActionType,
  RecoveryEntityType,
  RecoverySeverity,
} from "../constants/operational-recovery.constants";

export type RecordRecoveryEventInput = {
  companyId: string;
  moduleKey: string;
  entityType: RecoveryEntityType;
  entityId: string;
  entityLabel?: string;
  action: RecoveryActionType;
  actorUserId: string;
  actorRole: string;
  reason?: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
  severity?: RecoverySeverity;
  relatedWorkerId?: string;
  relatedDate?: Date | string;
  relatedAssignmentId?: string;
  relatedDienstId?: string;
  relatedWorkdaySummaryId?: string;
  relatedTripId?: string;
  payrollImpact?: PayrollImpact;
  praemienImpact?: PraemienImpact;
};

export type RecoverySnapshot = Record<string, unknown>;
