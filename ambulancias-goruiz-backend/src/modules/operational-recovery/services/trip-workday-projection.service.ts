/**
 * Phase 4.2 — Trip Correction → WorkdaySummaryCorrection projection.
 *
 * After a TripCorrection is created, projects effective trip aggregates into
 * WorkdaySummaryCorrection via the existing workday recovery service.
 *
 * WorkdaySummaryCorrection remains the sole effective Workday aggregate path.
 */
import mongoose from "mongoose";
import WorkdaySummary, {
  type IWorkdaySummary,
} from "../../workday-summary/models/workday-summary.model";
import { Trip } from "../../trips/models/trip.model";
import TripCorrection from "../models/trip-correction.model";
import OperationalRecoveryEvent from "../models/operational-recovery-event.model";
import { RECOVERY_PAYROLL_IMPACT } from "../constants/operational-recovery.constants";
import { OperationalRecoveryError } from "./operational-recovery.service";
import {
  createWorkdaySummaryCorrection,
  getEffectiveWorkdaySummary,
} from "./workday-recovery.service";
import {
  projectEffectiveTripAggregates,
  sumProjectableTripKm,
} from "./effective-trip-projection.service";
import {
  voidEmitWorkdayAdminSideEffects,
  voidEmitWorkdayWorkerRefresh,
} from "../../notifications";
import type { IWorkdaySummaryCorrection } from "../models/workday-summary-correction.model";
import type {
  ProjectTripCorrectionToWorkdayInput,
  TripWorkdayProjectionResult,
} from "../types/trip-workday-projection.types";

function sumOriginalTripKmFromDocuments(
  trips: Array<{ kmStart?: number; kmEnd?: number; countsTrip: 0 | 1 }>,
): number {
  return sumProjectableTripKm(
    trips.map((trip) => ({
      countsTrip: trip.countsTrip,
      wasCancelled: false,
      kmStart: trip.kmStart,
      kmEnd: trip.kmEnd,
    })),
  );
}

async function resolveRecoveryEventSource(
  correction: IWorkdaySummaryCorrection | null,
): Promise<string | null> {
  if (!correction?.recoveryEventId) return null;
  const event = await OperationalRecoveryEvent.findById(correction.recoveryEventId);
  const source = event?.metadata?.source;
  return typeof source === "string" ? source : null;
}

async function assertManualKmProjectionAllowed(
  summary: IWorkdaySummary,
  companyId: string,
  effectiveTrips: import("../types/trip-recovery.types").EffectiveTrip[],
): Promise<void> {
  const workdaySummaryId = String(summary._id);
  const effectiveWorkday = await getEffectiveWorkdaySummary({
    companyId,
    workdaySummaryId,
  });

  const activeSource = await resolveRecoveryEventSource(
    effectiveWorkday.activeCorrection,
  );
  const hasManualKmCorrection =
    activeSource === "workday_recovery" &&
    (effectiveWorkday.activeCorrection?.correctedFinalKm !== undefined ||
      effectiveWorkday.activeCorrection?.correctedTotalDienstKm !== undefined);

  if (!hasManualKmCorrection) return;

  const originalTrips = await Trip.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId: new mongoose.Types.ObjectId(summary.assignmentId),
    date: summary.date,
  });

  const baselineTripKmTotal = sumOriginalTripKmFromDocuments(originalTrips);
  const projection = projectEffectiveTripAggregates(effectiveTrips, {
    date: summary.date,
    dienstStartTime: summary.startTime ?? null,
    praemienRulesSnapshot: summary.praemienRulesSnapshot,
    baselineFinalKm: summary.finalKm,
    baselineTotalDienstKm: summary.totalDienstKm,
    baselineTripKmTotal,
  });

  if (projection.tripKmDelta !== 0) {
    throw new OperationalRecoveryError(
      "Cannot project trip km changes while a manual Workday km correction is active. Resolve the manual correction first.",
      409,
    );
  }
}

function verifySummaryMatchesContext(
  summary: IWorkdaySummary,
  assignmentId: string,
  date: string,
  companyId: string,
): void {
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
  if (summary.assignmentId !== assignmentId) {
    throw new OperationalRecoveryError(
      "WorkdaySummary assignmentId does not match correction context",
      400,
    );
  }
  if (summary.date !== date) {
    throw new OperationalRecoveryError(
      "WorkdaySummary date does not match correction context",
      400,
    );
  }
}

/**
 * Validates that trip correction can be projected into Workday without corrupting
 * manual km corrections. Called before TripCorrection is persisted.
 */
export async function validateTripWorkdayProjectionFeasibility(
  input: Pick<
    ProjectTripCorrectionToWorkdayInput,
    "companyId" | "assignmentId" | "date" | "effectiveTrips" | "relatedWorkdaySummaryId"
  >,
): Promise<void> {
  const companyId = input.companyId.trim();
  const assignmentId = input.assignmentId.trim();
  const date = input.date.trim();

  const summary = await WorkdaySummary.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId,
    date,
    isFinalClosure: true,
  });

  if (!summary) return;

  verifySummaryMatchesContext(summary, assignmentId, date, companyId);

  if (
    input.relatedWorkdaySummaryId &&
    input.relatedWorkdaySummaryId !== String(summary._id)
  ) {
    throw new OperationalRecoveryError(
      "relatedWorkdaySummaryId does not match the final WorkdaySummary for this context",
      400,
    );
  }

  await assertManualKmProjectionAllowed(summary, companyId, input.effectiveTrips);
}

/**
 * Projects a TripCorrection into WorkdaySummaryCorrection when a final
 * WorkdaySummary exists for the same assignment/date.
 *
 * Skips silently when no final summary exists.
 * Never mutates original Trip or WorkdaySummary documents.
 */
export async function projectTripCorrectionToWorkday(
  input: ProjectTripCorrectionToWorkdayInput,
): Promise<TripWorkdayProjectionResult> {
  const companyId = input.companyId.trim();
  const assignmentId = input.assignmentId.trim();
  const date = input.date.trim();

  const summary = await WorkdaySummary.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId,
    date,
    isFinalClosure: true,
  });

  if (!summary) {
    return { skipped: true, skipReason: "no_final_workday_summary" };
  }

  verifySummaryMatchesContext(summary, assignmentId, date, companyId);

  if (
    input.relatedWorkdaySummaryId &&
    input.relatedWorkdaySummaryId !== String(summary._id)
  ) {
    throw new OperationalRecoveryError(
      "relatedWorkdaySummaryId does not match the final WorkdaySummary for this context",
      400,
    );
  }

  const workdaySummaryId = String(summary._id);

  const [originalTrips, effectiveWorkday] = await Promise.all([
    Trip.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      assignmentId: new mongoose.Types.ObjectId(assignmentId),
      date,
    }),
    getEffectiveWorkdaySummary({ companyId, workdaySummaryId }),
  ]);

  const baselineTripKmTotal = sumOriginalTripKmFromDocuments(originalTrips);
  const projection = projectEffectiveTripAggregates(input.effectiveTrips, {
      date,
      dienstStartTime: summary.startTime ?? null,
      praemienRulesSnapshot: summary.praemienRulesSnapshot,
      baselineFinalKm: summary.finalKm,
      baselineTotalDienstKm: summary.totalDienstKm,
      baselineTripKmTotal,
    },
  );

  const activeSource = await resolveRecoveryEventSource(
    effectiveWorkday.activeCorrection,
  );
  const hasManualKmCorrection =
    activeSource === "workday_recovery" &&
    (effectiveWorkday.activeCorrection?.correctedFinalKm !== undefined ||
      effectiveWorkday.activeCorrection?.correctedTotalDienstKm !== undefined);

  let correctedFinalKm = projection.finalKm;
  let correctedTotalDienstKm = projection.totalDienstKm;

  if (hasManualKmCorrection) {
    correctedFinalKm = effectiveWorkday.finalKm;
    correctedTotalDienstKm = effectiveWorkday.totalDienstKm;
  }

  const workdayResult = await createWorkdaySummaryCorrection({
    companyId,
    workdaySummaryId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    correctedTotalRealTrips: projection.totalRealTrips,
    correctedTotalEffectivePatients: projection.totalEffectivePatients,
    correctedTotalDienstKm,
    correctedFinalKm,
    correctionReason: "Trip correction updated effective Workday totals",
    correctionNote: input.tripCorrectionReason,
    praemienImpact: input.praemienImpact,
    payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
    recoveryMetadataSource: "trip_recovery_projection",
    relatedTripCorrectionId: input.tripCorrectionId,
  });

  await TripCorrection.updateOne(
    { _id: new mongoose.Types.ObjectId(input.tripCorrectionId) },
    {
      $set: {
        relatedWorkdaySummaryId: new mongoose.Types.ObjectId(workdaySummaryId),
        relatedWorkdaySummaryCorrectionId: workdayResult.correction._id,
      },
    },
  );

  voidEmitWorkdayAdminSideEffects(companyId);
  voidEmitWorkdayWorkerRefresh(
    [String(summary.driver), String(summary.medic)],
    companyId,
  );

  return {
    skipped: false,
    workdaySummaryId,
    workdaySummaryCorrectionId: String(workdayResult.correction._id),
    supersededWorkdayCorrection: workdayResult.superseded,
  };
}

function buildProjectionTotals(values: {
  totalRealTrips: number;
  totalEffectivePatients: number;
  totalDienstKm: number;
  finalKm?: number;
}): import("../types/trip-workday-projection.types").WorkdayProjectionTotals {
  return {
    totalRealTrips: values.totalRealTrips,
    totalEffectivePatients: values.totalEffectivePatients,
    totalDienstKm: values.totalDienstKm,
    finalKm: values.finalKm,
  };
}

/**
 * Read-only Workday projection preview for Trip Recovery admin preview.
 * Does not write corrections or emit websocket events.
 */
export async function previewTripWorkdayProjection(input: {
  companyId: string;
  assignmentId: string;
  date: string;
  effectiveTrips: import("../types/trip-recovery.types").EffectiveTrip[];
  relatedWorkdaySummaryId?: string;
}): Promise<import("../types/trip-workday-projection.types").TripWorkdayProjectionPreviewResult> {
  const companyId = input.companyId.trim();
  const assignmentId = input.assignmentId.trim();
  const date = input.date.trim();

  const summary = await WorkdaySummary.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId,
    date,
    isFinalClosure: true,
  });

  if (!summary) {
    return {
      projectionStatus: "skipped",
      skipReason: "no_final_workday_summary",
      wouldSupersedePreviousWorkdayCorrection: false,
      before: buildProjectionTotals({
        totalRealTrips: 0,
        totalEffectivePatients: 0,
        totalDienstKm: 0,
      }),
      after: buildProjectionTotals({
        totalRealTrips: 0,
        totalEffectivePatients: 0,
        totalDienstKm: 0,
      }),
    };
  }

  verifySummaryMatchesContext(summary, assignmentId, date, companyId);

  if (
    input.relatedWorkdaySummaryId &&
    input.relatedWorkdaySummaryId !== String(summary._id)
  ) {
    throw new OperationalRecoveryError(
      "relatedWorkdaySummaryId does not match the final WorkdaySummary for this context",
      400,
    );
  }

  const workdaySummaryId = String(summary._id);

  const [originalTrips, effectiveWorkday] = await Promise.all([
    Trip.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      assignmentId: new mongoose.Types.ObjectId(assignmentId),
      date,
    }),
    getEffectiveWorkdaySummary({ companyId, workdaySummaryId }),
  ]);

  const beforeTotals = buildProjectionTotals({
    totalRealTrips: effectiveWorkday.totalRealTrips,
    totalEffectivePatients: effectiveWorkday.totalEffectivePatients,
    totalDienstKm: effectiveWorkday.totalDienstKm,
    finalKm: effectiveWorkday.finalKm,
  });

  const baselineTripKmTotal = sumOriginalTripKmFromDocuments(originalTrips);
  const projection = projectEffectiveTripAggregates(input.effectiveTrips, {
    date,
    dienstStartTime: summary.startTime ?? null,
    praemienRulesSnapshot: summary.praemienRulesSnapshot,
    baselineFinalKm: summary.finalKm,
    baselineTotalDienstKm: summary.totalDienstKm,
    baselineTripKmTotal,
  });

  const activeSource = await resolveRecoveryEventSource(
    effectiveWorkday.activeCorrection,
  );
  const hasManualKmCorrection =
    activeSource === "workday_recovery" &&
    (effectiveWorkday.activeCorrection?.correctedFinalKm !== undefined ||
      effectiveWorkday.activeCorrection?.correctedTotalDienstKm !== undefined);

  let afterFinalKm = projection.finalKm;
  let afterTotalDienstKm = projection.totalDienstKm;

  if (hasManualKmCorrection) {
    afterFinalKm = effectiveWorkday.finalKm;
    afterTotalDienstKm = effectiveWorkday.totalDienstKm;
  }

  return {
    workdaySummaryId,
    projectionStatus: "applied",
    wouldSupersedePreviousWorkdayCorrection: effectiveWorkday.hasCorrectedValues,
    before: beforeTotals,
    after: buildProjectionTotals({
      totalRealTrips: projection.totalRealTrips,
      totalEffectivePatients: projection.totalEffectivePatients,
      totalDienstKm: afterTotalDienstKm,
      finalKm: afterFinalKm,
    }),
  };
}
