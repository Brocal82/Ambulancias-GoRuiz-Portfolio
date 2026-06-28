/**
 * Phase 3.1 — Workday Recovery service I/O types.
 */
import type { IWorkdaySummaryCorrection } from "../models/workday-summary-correction.model";
import type {
  PayrollImpact,
  PraemienImpact,
} from "../constants/operational-recovery.constants";

export interface CreateWorkdaySummaryCorrectionInput {
  /** Admin's company — service validates ownership against this. */
  companyId: string;
  /** The WorkdaySummary being corrected. */
  workdaySummaryId: string;
  /** Actor must be "admin". */
  actorUserId: string;
  actorRole: string;

  // ── Corrected effective values (at least one required) ───────────────────
  correctedFinalKm?: number;
  correctedTotalDienstKm?: number;
  correctedTotalEffectivePatients?: number;
  correctedTotalRealTrips?: number;

  // ── Correction metadata ───────────────────────────────────────────────────
  /** Required — must describe why the correction is being made. */
  correctionReason: string;
  correctionNote?: string;

  // ── Impact flags ──────────────────────────────────────────────────────────
  praemienImpact: PraemienImpact;
  payrollImpact: PayrollImpact;
}

export interface GetEffectiveWorkdaySummaryInput {
  workdaySummaryId: string;
  companyId: string;
}

/**
 * The snapshot of the original (unmodified) metric fields.
 * Always reflects the stored WorkdaySummary — never mutated.
 */
export interface OriginalWorkdayValues {
  finalKm: number | undefined;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
}

/**
 * Effective view of a WorkdaySummary for operational use.
 *
 * When `hasCorrectedValues` is true:
 *   - Metric fields reflect the active correction's overrides.
 *   - `originalValues` holds the original (unmodified) metrics for audit.
 *   - `activeCorrection` holds the full active correction document.
 *
 * When `hasCorrectedValues` is false:
 *   - Metric fields reflect the original WorkdaySummary directly.
 *   - `originalValues` and `activeCorrection` are null.
 */
export interface EffectiveWorkdaySummary {
  summaryId: string;
  date: string;
  assignmentId: string;
  companyId: string | null;
  driver: string;
  medic: string;
  isFinalClosure: boolean;
  isReviewed: boolean;

  // ── Effective metric values (original or corrected) ───────────────────────
  finalKm: number | undefined;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;

  // ── Correction context ────────────────────────────────────────────────────
  hasCorrectedValues: boolean;
  activeCorrection: IWorkdaySummaryCorrection | null;
  /** Populated only when hasCorrectedValues is true. */
  originalValues: OriginalWorkdayValues | null;
}

export interface CreateWorkdaySummaryCorrectionResult {
  correction: IWorkdaySummaryCorrection;
  effective: EffectiveWorkdaySummary;
  /** True when a previous active correction was superseded. */
  superseded: boolean;
}
