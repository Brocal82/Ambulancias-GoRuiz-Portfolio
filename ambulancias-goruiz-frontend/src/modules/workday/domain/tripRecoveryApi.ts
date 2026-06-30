/**
 * Phase 4.4 — Trip Recovery Admin API client.
 * HTTP calls belong in domain files — no direct calls from components.
 */
import axios from "../../../api/axios";
import type { ImpactLevel } from "./workdayRecoveryApi";

export type TripPresentationType =
  | "original"
  | "corrected"
  | "voided"
  | "forgotten";

export type TripCorrectionType = "correct" | "void" | "add_forgotten";

export interface TripOperationalValuesDTO {
  countsTrip: 0 | 1;
  wasCancelled: boolean;
  cancelledAtPickup?: boolean;
  kmStart?: number;
  kmEnd?: number;
  timeWarning?: string;
  timeAtHome?: string;
  timePickup?: string;
  timeArrival?: string;
  timeEnd?: string;
}

export interface EffectiveTripDTO {
  tripKey: string;
  type: TripPresentationType;
  isIncludedInEffectiveCount: boolean;
  values: TripOperationalValuesDTO;
  changedFields?: string[];
}

export interface WorkdayProjectionTotalsDTO {
  totalRealTrips: number;
  totalEffectivePatients: number;
  totalDienstKm: number;
  finalKm?: number;
}

export interface WorkdayProjectionDTO {
  workdaySummaryId?: string;
  projectionStatus: "applied" | "skipped";
  skipReason?: string;
  supersededPreviousWorkdayCorrection: boolean;
  before: WorkdayProjectionTotalsDTO;
  after: WorkdayProjectionTotalsDTO;
}

export interface TripCorrectionPreviewResponse {
  trip: EffectiveTripDTO;
  workday: WorkdayProjectionDTO;
  praemienImpact: string;
  wouldSupersedePreviousCorrection: boolean;
}

export interface TripCorrectionCreatedResponse {
  correction: {
    id: string;
    type: string;
    status: string;
    reason: string;
    note?: string;
    correctedAt: string;
    supersededPreviousCorrection: boolean;
  };
  trip: EffectiveTripDTO;
  workday: WorkdayProjectionDTO;
  praemienImpact: string;
}

export interface EffectiveTripsListResponse {
  workdaySummaryId: string;
  assignmentId: string;
  date: string;
  workerIds: string[];
  effectiveTripCount: number;
  trips: EffectiveTripDTO[];
}

export interface TripCorrectionEffectiveFields {
  effectiveCountsTrip?: 0 | 1;
  effectiveWasCancelled?: boolean;
  effectiveCancelledAtPickup?: boolean;
  effectiveKmStart?: number;
  effectiveKmEnd?: number;
  effectiveTimeWarning?: string;
  effectiveTimeAtHome?: string;
  effectiveTimePickup?: string;
  effectiveTimeArrival?: string;
  effectiveTimeEnd?: string;
}

export interface TripCorrectionPreviewInput extends TripCorrectionEffectiveFields {
  correctionType: TripCorrectionType;
  reason: string;
  note?: string;
  praemienImpact: ImpactLevel;
  originalTripId?: string;
  workdaySummaryId?: string;
}

export type TripCorrectionCreateInput = TripCorrectionPreviewInput;

export async function getEffectiveTripsForWorkdaySummary(
  workdaySummaryId: string,
): Promise<EffectiveTripsListResponse> {
  const res = await axios.get<EffectiveTripsListResponse>(
    `/operational-recovery/workday-summaries/${workdaySummaryId}/effective-trips`,
  );
  return res.data;
}

export async function previewTripCorrection(
  input: TripCorrectionPreviewInput,
): Promise<TripCorrectionPreviewResponse> {
  const res = await axios.post<TripCorrectionPreviewResponse>(
    "/operational-recovery/trip-corrections/preview",
    input,
  );
  return res.data;
}

export async function createTripCorrection(
  input: TripCorrectionCreateInput,
): Promise<TripCorrectionCreatedResponse> {
  const res = await axios.post<TripCorrectionCreatedResponse>(
    "/operational-recovery/trip-corrections",
    input,
  );
  return res.data;
}
