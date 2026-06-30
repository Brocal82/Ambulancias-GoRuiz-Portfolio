/**
 * Phase 4.1 — Trip Recovery service I/O types.
 */
import type { ITripCorrection, TripCorrectionType } from "../models/trip-correction.model";
import type { PraemienImpact } from "../constants/operational-recovery.constants";

export interface TripOperationalValues {
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

export interface CreateTripCorrectionInput {
  companyId: string;
  correctionType: TripCorrectionType;
  actorUserId: string;
  actorRole: string;

  /** Required for correct / void / replace. */
  originalTripId?: string;
  replacementTripId?: string;

  /** Required for add_forgotten; denormalized from Trip when correcting existing trips. */
  assignmentId?: string;
  date?: string;
  workerIds?: string[];

  relatedWorkdaySummaryId?: string;
  relatedWorkdaySummaryCorrectionId?: string;

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

  reason: string;
  note?: string;
  praemienImpact: PraemienImpact;
}

export interface GetEffectiveTripInput {
  companyId: string;
  tripId: string;
}

export interface GetEffectiveTripsForWorkdayInput {
  companyId: string;
  assignmentId: string;
  date: string;
}

export interface EffectiveTrip {
  tripId: string | null;
  assignmentId: string;
  date: string;
  companyId: string;
  driver: string | null;
  medic: string | null;

  correctionType: TripCorrectionType | null;
  isSynthetic: boolean;
  isEffectivelyVoided: boolean;
  isIncludedInEffectiveCount: boolean;
  hasCorrectedValues: boolean;
  activeCorrection: ITripCorrection | null;
  originalValues: TripOperationalValues | null;

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

export interface CreateTripCorrectionResult {
  correction: ITripCorrection;
  effective: EffectiveTrip;
  /** True when a previous active correction for the same originalTripId was superseded. */
  superseded: boolean;
}

export interface EffectiveTripsForWorkdayResult {
  assignmentId: string;
  date: string;
  trips: EffectiveTrip[];
  effectiveTripCount: number;
}
