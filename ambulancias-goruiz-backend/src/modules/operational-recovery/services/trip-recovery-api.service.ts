/**
 * Phase 4.3 — Trip Recovery Admin API orchestration.
 *
 * Maps HTTP-safe bodies to service inputs (auth from JWT only).
 * Enforces API-specific validation (final WorkdaySummary anchor, no client workerIds).
 */
import mongoose from "mongoose";
import { Trip } from "../../trips/models/trip.model";
import WorkdaySummary, {
  type IWorkdaySummary,
} from "../../workday-summary/models/workday-summary.model";
import { TRIP_CORRECTION_TYPE, type TripCorrectionType } from "../models/trip-correction.model";
import { OperationalRecoveryError } from "./operational-recovery.service";
import {
  createTripCorrection,
  previewTripCorrection,
  getEffectiveTripsForWorkday,
} from "./trip-recovery.service";
import type { CreateTripCorrectionInput } from "../types/trip-recovery.types";
import type {
  EffectiveTripsByWorkdaySummaryResult,
  PreviewTripCorrectionResult,
  TripRecoveryAuthContext,
} from "../types/trip-recovery-api.types";
import type { CreateTripCorrectionResult } from "../types/trip-recovery.types";
import type { TripCorrectionBody } from "../schemas/trip-recovery.schema";

function requireValidObjectId(value: string, field: string): string {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new OperationalRecoveryError(`${field} must be a valid ObjectId`, 400);
  }
  return value;
}

async function loadFinalWorkdaySummary(
  workdaySummaryId: string,
  companyId: string,
): Promise<IWorkdaySummary> {
  const id = requireValidObjectId(workdaySummaryId, "workdaySummaryId");
  const summary = await WorkdaySummary.findById(id);
  if (!summary) {
    throw new OperationalRecoveryError("WorkdaySummary not found", 404);
  }
  if (summary.companyId == null) {
    throw new OperationalRecoveryError(
      "WorkdaySummary has no company scope (legacy record)",
      403,
    );
  }
  if (String(summary.companyId) !== companyId) {
    throw new OperationalRecoveryError(
      "WorkdaySummary does not belong to your company",
      403,
    );
  }
  if (!summary.isFinalClosure) {
    throw new OperationalRecoveryError(
      "Only final WorkdaySummaries are eligible for trip recovery",
      422,
    );
  }
  return summary;
}

async function loadFinalWorkdayForTrip(
  companyId: string,
  assignmentId: string,
  date: string,
): Promise<IWorkdaySummary> {
  const summary = await WorkdaySummary.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId,
    date,
    isFinalClosure: true,
  });
  if (!summary) {
    throw new OperationalRecoveryError(
      "No final WorkdaySummary exists for this trip context",
      422,
    );
  }
  if (summary.companyId == null) {
    throw new OperationalRecoveryError(
      "WorkdaySummary has no company scope (legacy record)",
      403,
    );
  }
  return summary;
}

function mapEffectiveFields(body: TripCorrectionBody) {
  return {
    effectiveCountsTrip: body.effectiveCountsTrip,
    effectiveWasCancelled: body.effectiveWasCancelled,
    effectiveCancelledAtPickup: body.effectiveCancelledAtPickup,
    effectiveKmStart: body.effectiveKmStart,
    effectiveKmEnd: body.effectiveKmEnd,
    effectiveTimeWarning: body.effectiveTimeWarning,
    effectiveTimeAtHome: body.effectiveTimeAtHome,
    effectiveTimePickup: body.effectiveTimePickup,
    effectiveTimeArrival: body.effectiveTimeArrival,
    effectiveTimeEnd: body.effectiveTimeEnd,
  };
}

export async function buildCreateTripCorrectionInputFromApi(
  body: TripCorrectionBody,
  auth: TripRecoveryAuthContext,
): Promise<CreateTripCorrectionInput> {
  const base = {
    companyId: auth.companyId,
    actorUserId: auth.actorUserId,
    actorRole: auth.actorRole,
    correctionType: body.correctionType as TripCorrectionType,
    reason: body.reason,
    note: body.note,
    praemienImpact: body.praemienImpact,
    ...mapEffectiveFields(body),
  };

  if (body.correctionType === TRIP_CORRECTION_TYPE.ADD_FORGOTTEN) {
    const summary = await loadFinalWorkdaySummary(body.workdaySummaryId, auth.companyId);
    return {
      ...base,
      relatedWorkdaySummaryId: String(summary._id),
      assignmentId: summary.assignmentId,
      date: summary.date,
      workerIds: [String(summary.driver), String(summary.medic)],
    };
  }

  const originalTripId = requireValidObjectId(body.originalTripId, "originalTripId");
  const trip = await Trip.findById(originalTripId);
  if (!trip) {
    throw new OperationalRecoveryError("Trip not found", 404);
  }
  if (trip.companyId == null) {
    throw new OperationalRecoveryError(
      "Trip has no company scope (legacy record). Cannot be corrected via recovery.",
      403,
    );
  }
  if (String(trip.companyId) !== auth.companyId) {
    throw new OperationalRecoveryError("Trip does not belong to your company", 403);
  }
  if (!trip.sentInSummary) {
    throw new OperationalRecoveryError(
      "Only trips included in a closed workday summary are eligible for correction",
      400,
    );
  }

  const summary = await loadFinalWorkdayForTrip(
    auth.companyId,
    String(trip.assignmentId),
    trip.date,
  );

  if (body.workdaySummaryId && body.workdaySummaryId !== String(summary._id)) {
    throw new OperationalRecoveryError(
      "workdaySummaryId does not match the trip workday context",
      400,
    );
  }

  return {
    ...base,
    originalTripId,
    relatedWorkdaySummaryId: String(summary._id),
  };
}

export async function previewTripCorrectionFromApi(
  body: TripCorrectionBody,
  auth: TripRecoveryAuthContext,
): Promise<PreviewTripCorrectionResult> {
  const input = await buildCreateTripCorrectionInputFromApi(body, auth);
  return previewTripCorrection(input);
}

export async function createTripCorrectionFromApi(
  body: TripCorrectionBody,
  auth: TripRecoveryAuthContext,
): Promise<CreateTripCorrectionResult> {
  const input = await buildCreateTripCorrectionInputFromApi(body, auth);
  return createTripCorrection(input);
}

export async function getEffectiveTripsByWorkdaySummary(
  workdaySummaryId: string,
  companyId: string,
): Promise<EffectiveTripsByWorkdaySummaryResult> {
  const summary = await loadFinalWorkdaySummary(workdaySummaryId, companyId);
  const result = await getEffectiveTripsForWorkday({
    companyId,
    assignmentId: summary.assignmentId,
    date: summary.date,
  });

  return {
    workdaySummaryId: String(summary._id),
    assignmentId: summary.assignmentId,
    date: summary.date,
    workerIds: [String(summary.driver), String(summary.medic)],
    trips: result.trips,
    effectiveTripCount: result.effectiveTripCount,
  };
}
