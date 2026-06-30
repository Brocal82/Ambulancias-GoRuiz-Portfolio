/**
 * Phase 4.3 — Response DTOs for Trip Recovery Admin API.
 */
import { TRIP_CORRECTION_TYPE } from "../models/trip-correction.model";
import type { ITripCorrection } from "../models/trip-correction.model";
import type { EffectiveTrip } from "../types/trip-recovery.types";
import type { CreateTripCorrectionResult } from "../types/trip-recovery.types";
import type { PreviewTripCorrectionResult } from "../types/trip-recovery-api.types";
import type { EffectiveTripsByWorkdaySummaryResult } from "../types/trip-recovery-api.types";
import type {
  TripWorkdayProjectionPreviewResult,
  TripWorkdayProjectionResult,
  WorkdayProjectionTotals,
} from "../types/trip-workday-projection.types";

export type TripPresentationType = "original" | "corrected" | "voided" | "forgotten";

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

export interface TripCorrectionSummaryDTO {
  id: string;
  type: string;
  status: string;
  reason: string;
  note?: string;
  correctedAt: string;
  supersededPreviousCorrection: boolean;
}

export interface WorkdayProjectionDTO {
  workdaySummaryId?: string;
  projectionStatus: "applied" | "skipped";
  skipReason?: string;
  supersededPreviousWorkdayCorrection: boolean;
  before: WorkdayProjectionTotals;
  after: WorkdayProjectionTotals;
}

export interface TripCorrectionPreviewResponseDTO {
  trip: EffectiveTripDTO;
  workday: WorkdayProjectionDTO;
  praemienImpact: string;
  wouldSupersedePreviousCorrection: boolean;
}

export interface TripCorrectionCreatedResponseDTO {
  correction: TripCorrectionSummaryDTO;
  trip: EffectiveTripDTO;
  workday: WorkdayProjectionDTO;
  praemienImpact: string;
}

export interface EffectiveTripsListResponseDTO {
  workdaySummaryId: string;
  assignmentId: string;
  date: string;
  workerIds: string[];
  effectiveTripCount: number;
  trips: EffectiveTripDTO[];
}

function mapTripPresentationType(
  effective: EffectiveTrip,
  correctionType?: string | null,
): TripPresentationType {
  if (effective.isSynthetic || correctionType === TRIP_CORRECTION_TYPE.ADD_FORGOTTEN) {
    return "forgotten";
  }
  if (effective.isEffectivelyVoided || correctionType === TRIP_CORRECTION_TYPE.VOID) {
    return "voided";
  }
  if (effective.hasCorrectedValues) {
    return "corrected";
  }
  return "original";
}

function toOperationalValuesDTO(effective: EffectiveTrip): TripOperationalValuesDTO {
  return {
    countsTrip: effective.countsTrip,
    wasCancelled: effective.wasCancelled,
    cancelledAtPickup: effective.cancelledAtPickup,
    kmStart: effective.kmStart,
    kmEnd: effective.kmEnd,
    timeWarning: effective.timeWarning,
    timeAtHome: effective.timeAtHome,
    timePickup: effective.timePickup,
    timeArrival: effective.timeArrival,
    timeEnd: effective.timeEnd,
  };
}

export function toEffectiveTripDTO(
  effective: EffectiveTrip,
  changedFields?: string[],
): EffectiveTripDTO {
  const tripKey =
    effective.tripId ??
    (effective.activeCorrection
      ? `synthetic-${String(effective.activeCorrection._id)}`
      : `synthetic-${effective.assignmentId}-${effective.date}`);

  const dto: EffectiveTripDTO = {
    tripKey,
    type: mapTripPresentationType(
      effective,
      effective.correctionType ?? effective.activeCorrection?.correctionType,
    ),
    isIncludedInEffectiveCount: effective.isIncludedInEffectiveCount,
    values: toOperationalValuesDTO(effective),
  };

  if (changedFields && changedFields.length > 0) {
    dto.changedFields = changedFields;
  }

  return dto;
}

function toWorkdayProjectionDTOFromPreview(
  preview: TripWorkdayProjectionPreviewResult,
): WorkdayProjectionDTO {
  return {
    workdaySummaryId: preview.workdaySummaryId,
    projectionStatus: preview.projectionStatus,
    skipReason: preview.skipReason,
    supersededPreviousWorkdayCorrection: preview.wouldSupersedePreviousWorkdayCorrection,
    before: preview.before,
    after: preview.after,
  };
}

function toWorkdayProjectionDTOFromResult(
  result: TripWorkdayProjectionResult,
  before: WorkdayProjectionTotals,
  after: WorkdayProjectionTotals,
): WorkdayProjectionDTO {
  return {
    workdaySummaryId: result.workdaySummaryId,
    projectionStatus: result.skipped ? "skipped" : "applied",
    skipReason: result.skipReason,
    supersededPreviousWorkdayCorrection: result.supersededWorkdayCorrection ?? false,
    before,
    after,
  };
}

function toCorrectionSummaryDTO(
  correction: ITripCorrection,
  supersededPreviousCorrection: boolean,
): TripCorrectionSummaryDTO {
  return {
    id: String(correction._id),
    type: correction.correctionType,
    status: correction.status,
    reason: correction.reason,
    note: correction.note || undefined,
    correctedAt: correction.createdAt.toISOString(),
    supersededPreviousCorrection,
  };
}

export function toTripCorrectionPreviewResponseDTO(
  result: PreviewTripCorrectionResult,
): TripCorrectionPreviewResponseDTO {
  return {
    trip: toEffectiveTripDTO(result.effective, result.changedFields),
    workday: toWorkdayProjectionDTOFromPreview(result.workdayProjection),
    praemienImpact: result.praemienImpact,
    wouldSupersedePreviousCorrection: result.wouldSupersedePreviousCorrection,
  };
}

export function toTripCorrectionCreatedResponseDTO(
  result: CreateTripCorrectionResult,
  workdayBefore: WorkdayProjectionTotals,
  workdayAfter: WorkdayProjectionTotals,
): TripCorrectionCreatedResponseDTO {
  const workday: WorkdayProjectionDTO = result.workdayProjection.skipped
    ? {
        workdaySummaryId: result.workdayProjection.workdaySummaryId,
        projectionStatus: "skipped",
        skipReason: result.workdayProjection.skipReason,
        supersededPreviousWorkdayCorrection:
          result.workdayProjection.supersededWorkdayCorrection ?? false,
        before: workdayBefore,
        after: workdayAfter,
      }
    : toWorkdayProjectionDTOFromResult(
        result.workdayProjection,
        workdayBefore,
        workdayAfter,
      );

  return {
    correction: toCorrectionSummaryDTO(result.correction, result.superseded),
    trip: toEffectiveTripDTO(result.effective),
    workday,
    praemienImpact: result.correction.praemienImpact,
  };
}

export function toEffectiveTripsListResponseDTO(
  result: EffectiveTripsByWorkdaySummaryResult,
): EffectiveTripsListResponseDTO {
  return {
    workdaySummaryId: result.workdaySummaryId,
    assignmentId: result.assignmentId,
    date: result.date,
    workerIds: result.workerIds,
    effectiveTripCount: result.effectiveTripCount,
    trips: result.trips.map((trip) => toEffectiveTripDTO(trip)),
  };
}
