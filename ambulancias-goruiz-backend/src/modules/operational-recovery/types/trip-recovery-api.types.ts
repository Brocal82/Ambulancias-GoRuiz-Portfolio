/**
 * Phase 4.3 — Trip Recovery Admin API service types.
 */
import type { PraemienImpact } from "../constants/operational-recovery.constants";
import type { EffectiveTrip } from "./trip-recovery.types";
import type { TripWorkdayProjectionPreviewResult } from "./trip-workday-projection.types";

export interface TripRecoveryAuthContext {
  companyId: string;
  actorUserId: string;
  actorRole: string;
}

export interface PreviewTripCorrectionResult {
  effective: EffectiveTrip;
  changedFields: string[];
  wouldSupersedePreviousCorrection: boolean;
  workdayProjection: TripWorkdayProjectionPreviewResult;
  praemienImpact: PraemienImpact;
}

export interface EffectiveTripsByWorkdaySummaryResult {
  workdaySummaryId: string;
  assignmentId: string;
  date: string;
  workerIds: string[];
  trips: EffectiveTrip[];
  effectiveTripCount: number;
}
