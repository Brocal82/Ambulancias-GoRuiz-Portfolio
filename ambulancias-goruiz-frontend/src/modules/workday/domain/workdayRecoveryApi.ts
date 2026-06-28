/**
 * Phase 3.3 — Workday Recovery API client.
 * Exposes getEffectiveWorkdaySummary and createWorkdayCorrection.
 * HTTP calls belong in domain/api files — no direct calls from components.
 */
import axios from "../../../api/axios";

export type ImpactLevel = "none" | "possible";

export interface ActiveCorrectionDTO {
  correctionReason: string;
  correctionNote?: string;
  correctedAt: string;
  praemienImpact: ImpactLevel;
  payrollImpact: ImpactLevel;
  correctedFinalKm?: number;
  correctedTotalDienstKm?: number;
  correctedTotalEffectivePatients?: number;
  correctedTotalRealTrips?: number;
}

export interface OriginalValuesDTO {
  finalKm: number | undefined;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
}

export interface EffectiveValues {
  finalKm: number | null;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
  hasCorrectedValues: boolean;
  activeCorrection: ActiveCorrectionDTO | null;
  original: OriginalValuesDTO | null;
}

export interface EffectiveWorkdaySummaryResponse {
  summaryId: string;
  assignmentId: string;
  date: string;
  workerIds: string[];
  isFinalClosure: boolean;
  isReviewed: boolean;
  effective: EffectiveValues;
}

export interface CreateWorkdayCorrectionInput {
  correctedFinalKm?: number;
  correctedTotalDienstKm?: number;
  correctedTotalEffectivePatients?: number;
  correctedTotalRealTrips?: number;
  correctionReason: string;
  correctionNote?: string;
  praemienImpact: ImpactLevel;
  payrollImpact: ImpactLevel;
}

export interface WorkdayCorrectionCreatedResponse {
  summaryId: string;
  correctionId: string;
  correctedAt: string;
  correctedFinalKm?: number;
  correctedTotalDienstKm?: number;
  correctedTotalEffectivePatients?: number;
  correctedTotalRealTrips?: number;
  praemienImpact: ImpactLevel;
  payrollImpact: ImpactLevel;
  correctionReason: string;
  correctionNote?: string;
}

export async function getEffectiveWorkdaySummary(
  summaryId: string,
): Promise<EffectiveWorkdaySummaryResponse> {
  const res = await axios.get<EffectiveWorkdaySummaryResponse>(
    `/workday-summary/${summaryId}/effective`,
  );
  return res.data;
}

export async function createWorkdayCorrection(
  summaryId: string,
  input: CreateWorkdayCorrectionInput,
): Promise<WorkdayCorrectionCreatedResponse> {
  const res = await axios.post<WorkdayCorrectionCreatedResponse>(
    `/workday-summary/${summaryId}/corrections`,
    input,
  );
  return res.data;
}
