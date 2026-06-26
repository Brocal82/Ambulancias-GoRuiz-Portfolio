/**
 * Types for the Absence Cleanup Monitor (Phase 2.1 + 2.2).
 * Detection-only and repair-only — no HTTP layer in this phase.
 */

export type AbsenceType = "vacation" | "sick";

/**
 * A single stale-assignment inconsistency: a worker is still assigned
 * to a Dienst shift while an accepted absence covers that date.
 */
export interface AbsenceInconsistency {
  workerId: string;
  workerName: string;
  absenceType: AbsenceType;
  absenceId: string;
  /** Full absence start (YYYY-MM-DD, Europe/Berlin) */
  absenceStartDate: string;
  /** Full absence end (YYYY-MM-DD, Europe/Berlin) */
  absenceEndDate: string;
  dienstId: string;
  dienstNumber?: number;
  assignmentRole: "driver" | "medic";
  /** The specific Dienst assignment date that is stale (YYYY-MM-DD) */
  assignmentDate: string;
}

export interface DetectAbsenceInconsistenciesInput {
  companyId: string;
  /** Optional scan start (YYYY-MM-DD). Defaults to no lower bound. */
  fromDate?: string;
  /** Optional scan end (YYYY-MM-DD). Defaults to no upper bound. */
  toDate?: string;
}

export interface RepairAbsenceInconsistencyInput {
  companyId: string;
  workerId: string;
  absenceType: AbsenceType;
  absenceId: string;
  /** User ID of the actor triggering the repair (for recovery event audit). */
  actorUserId: string;
  actorRole: string;
}

export interface RepairResult {
  /** Number of individual role-slot assignments cleared. */
  assignmentsTouched: number;
  /** Number of Dienst documents modified. */
  dienstsTouched: number;
  /** True when the cleanup ran but found nothing stale (0 assignments touched). */
  alreadyClean: boolean;
  /** True when the cleanup itself threw an error. */
  repairFailed: boolean;
  errorMessage?: string;
  /** Inconsistencies still present after the repair (should be empty on success). */
  remainingInconsistencies: AbsenceInconsistency[];
}
