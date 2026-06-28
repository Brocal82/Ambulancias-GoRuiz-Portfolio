/**
 * Phase 3.2 — Response DTOs for Workday Recovery HTTP endpoints.
 *
 * Rules:
 *   - No raw Mongoose documents returned to clients.
 *   - No internal IDs that the admin UI does not require.
 *   - No recoveryEventId.
 *   - No raw snapshots, metadata, or PII.
 */
import type { EffectiveWorkdaySummary } from "../../operational-recovery/types/workday-recovery.types";
import type { IWorkdaySummaryCorrection } from "../../operational-recovery/models/workday-summary-correction.model";
import type { CreateWorkdaySummaryCorrectionResult } from "../../operational-recovery/types/workday-recovery.types";

// ── Active correction sub-shape ───────────────────────────────────────────────

export interface ActiveCorrectionDTO {
  status: string;
  correctionReason: string;
  correctionNote?: string;
  correctedAt: string;
  correctedFinalKm?: number;
  correctedTotalDienstKm?: number;
  correctedTotalEffectivePatients?: number;
  correctedTotalRealTrips?: number;
  praemienImpact: string;
  payrollImpact: string;
}

// ── Effective values sub-shape ────────────────────────────────────────────────

export interface EffectiveValuesDTO {
  finalKm: number | undefined;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
  hasCorrectedValues: boolean;
  originalValues?: {
    finalKm: number | undefined;
    totalDienstKm: number;
    totalEffectivePatients: number;
    totalRealTrips: number;
  };
  activeCorrection?: ActiveCorrectionDTO;
}

// ── GET /effective response ───────────────────────────────────────────────────

export interface EffectiveWorkdaySummaryResponseDTO {
  summaryId: string;
  assignmentId: string;
  date: string;
  workerIds: string[];
  isFinalClosure: boolean;
  isReviewed: boolean;
  effective: EffectiveValuesDTO;
}

// ── POST /corrections response ────────────────────────────────────────────────

export interface WorkdayCorrectionCreatedResponseDTO {
  correctionId: string;
  summaryId: string;
  date: string;
  superseded: boolean;
  effective: EffectiveValuesDTO;
}

// ── Builders ──────────────────────────────────────────────────────────────────

function toCorrectionDTO(
  correction: IWorkdaySummaryCorrection,
): ActiveCorrectionDTO {
  return {
    status: correction.status,
    correctionReason: correction.correctionReason,
    correctionNote: correction.correctionNote || undefined,
    correctedAt: correction.correctedAt.toISOString(),
    correctedFinalKm: correction.correctedFinalKm,
    correctedTotalDienstKm: correction.correctedTotalDienstKm,
    correctedTotalEffectivePatients: correction.correctedTotalEffectivePatients,
    correctedTotalRealTrips: correction.correctedTotalRealTrips,
    praemienImpact: correction.praemienImpact,
    payrollImpact: correction.payrollImpact,
  };
}

function toEffectiveValuesDTO(effective: EffectiveWorkdaySummary): EffectiveValuesDTO {
  const dto: EffectiveValuesDTO = {
    finalKm: effective.finalKm,
    totalDienstKm: effective.totalDienstKm,
    totalEffectivePatients: effective.totalEffectivePatients,
    totalRealTrips: effective.totalRealTrips,
    hasCorrectedValues: effective.hasCorrectedValues,
  };

  if (effective.hasCorrectedValues && effective.originalValues) {
    dto.originalValues = {
      finalKm: effective.originalValues.finalKm,
      totalDienstKm: effective.originalValues.totalDienstKm,
      totalEffectivePatients: effective.originalValues.totalEffectivePatients,
      totalRealTrips: effective.originalValues.totalRealTrips,
    };
  }

  if (effective.hasCorrectedValues && effective.activeCorrection) {
    dto.activeCorrection = toCorrectionDTO(effective.activeCorrection);
  }

  return dto;
}

export function toEffectiveWorkdaySummaryResponseDTO(
  effective: EffectiveWorkdaySummary,
): EffectiveWorkdaySummaryResponseDTO {
  const workerIds = [effective.driver, effective.medic].filter(Boolean);

  return {
    summaryId: effective.summaryId,
    assignmentId: effective.assignmentId,
    date: effective.date,
    workerIds,
    isFinalClosure: effective.isFinalClosure,
    isReviewed: effective.isReviewed,
    effective: toEffectiveValuesDTO(effective),
  };
}

export function toWorkdayCorrectionCreatedResponseDTO(
  result: CreateWorkdaySummaryCorrectionResult,
): WorkdayCorrectionCreatedResponseDTO {
  return {
    correctionId: String(result.correction._id),
    summaryId: result.effective.summaryId,
    date: result.effective.date,
    superseded: result.superseded,
    effective: toEffectiveValuesDTO(result.effective),
  };
}
