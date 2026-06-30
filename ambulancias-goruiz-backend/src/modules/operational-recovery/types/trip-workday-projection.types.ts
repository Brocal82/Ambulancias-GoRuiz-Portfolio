/**
 * Phase 4.2 — Trip → Workday projection service I/O types.
 */
import type { PraemienImpact } from "../constants/operational-recovery.constants";
import type { EffectiveTrip } from "./trip-recovery.types";

export interface ProjectTripCorrectionToWorkdayInput {
  companyId: string;
  assignmentId: string;
  date: string;
  actorUserId: string;
  actorRole: string;
  tripCorrectionId: string;
  praemienImpact: PraemienImpact;
  tripCorrectionReason: string;
  /** Effective trips for the workday (from getEffectiveTripsForWorkday). */
  effectiveTrips: EffectiveTrip[];
  /** When provided, must match the resolved final WorkdaySummary. */
  relatedWorkdaySummaryId?: string;
}

export interface TripWorkdayProjectionResult {
  skipped: boolean;
  skipReason?: string;
  workdaySummaryId?: string;
  workdaySummaryCorrectionId?: string;
  supersededWorkdayCorrection?: boolean;
}

export interface WorkdayProjectionTotals {
  totalRealTrips: number;
  totalEffectivePatients: number;
  totalDienstKm: number;
  finalKm?: number;
}

export interface TripWorkdayProjectionPreviewResult {
  workdaySummaryId?: string;
  projectionStatus: "applied" | "skipped";
  skipReason?: string;
  wouldSupersedePreviousWorkdayCorrection: boolean;
  before: WorkdayProjectionTotals;
  after: WorkdayProjectionTotals;
}
