/**
 * Phase 4.1 — Trip Recovery service.
 *
 * Responsibilities:
 *   - createTripCorrection: validates, creates correction, records audit event
 *   - getEffectiveTrip: resolves effective (original or corrected) trip values
 *   - getEffectiveTripsForWorkday: effective trip list for assignment/date context
 *
 * Invariants:
 *   - Original Trip documents are NEVER mutated.
 *   - WorkdaySummary is NEVER mutated.
 *   - Every correction writes an immutable OperationalRecoveryEvent.
 *   - Multi-tenant: every lookup and write is scoped by companyId.
 *
 * Phase 4.1 scope:
 *   - Supported: correct, void, add_forgotten
 *   - Deferred: replace (explicit rejection)
 */
import mongoose from "mongoose";
import { Trip, type ITrip } from "../../trips/models/trip.model";
import User from "../../users/models/user.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import TripCorrection, {
  TRIP_CORRECTION_STATUS,
  TRIP_CORRECTION_TYPE,
  type ITripCorrection,
  type TripCorrectionType,
} from "../models/trip-correction.model";
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_PRAEMIEN_IMPACTS,
  RECOVERY_SEVERITY,
  type PraemienImpact,
  type RecoveryActionType,
} from "../constants/operational-recovery.constants";
import { recordRecoveryEvent, OperationalRecoveryError } from "./operational-recovery.service";
import {
  projectTripCorrectionToWorkday,
  validateTripWorkdayProjectionFeasibility,
  previewTripWorkdayProjection,
} from "./trip-workday-projection.service";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import type {
  CreateTripCorrectionInput,
  CreateTripCorrectionResult,
  EffectiveTrip,
  EffectiveTripsForWorkdayResult,
  GetEffectiveTripInput,
  GetEffectiveTripsForWorkdayInput,
  TripOperationalValues,
} from "../types/trip-recovery.types";
import type { PreviewTripCorrectionResult } from "../types/trip-recovery-api.types";

// ── Input validators ─────────────────────────────────────────────────────────

function requireValidObjectId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OperationalRecoveryError(`${field} is required`, 400);
  }
  const trimmed = value.trim();
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new OperationalRecoveryError(`${field} must be a valid ObjectId`, 400);
  }
  return trimmed;
}

function requireOptionalObjectId(value: unknown, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  return requireValidObjectId(value, field);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OperationalRecoveryError(`${field} is required`, 400);
  }
  return value.trim();
}

function assertAdminRole(actorRole: unknown): void {
  if (actorRole !== "admin") {
    throw new OperationalRecoveryError(
      "Trip corrections require admin role",
      403,
    );
  }
}

function assertEnumImpact<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new OperationalRecoveryError(`${field} has an invalid value`, 400);
  }
  return value as T;
}

function assertCorrectionType(value: unknown): TripCorrectionType {
  if (
    typeof value !== "string" ||
    !(Object.values(TRIP_CORRECTION_TYPE) as string[]).includes(value)
  ) {
    throw new OperationalRecoveryError("correctionType has an invalid value", 400);
  }
  return value as TripCorrectionType;
}

const EFFECTIVE_FIELD_KEYS = [
  "effectiveCountsTrip",
  "effectiveWasCancelled",
  "effectiveCancelledAtPickup",
  "effectiveKmStart",
  "effectiveKmEnd",
  "effectiveTimeWarning",
  "effectiveTimeAtHome",
  "effectiveTimePickup",
  "effectiveTimeArrival",
  "effectiveTimeEnd",
] as const;

function hasAnyEffectiveField(input: CreateTripCorrectionInput): boolean {
  return EFFECTIVE_FIELD_KEYS.some(
    (key) => input[key as keyof CreateTripCorrectionInput] !== undefined,
  );
}

function assertEffectiveKmRange(input: CreateTripCorrectionInput): void {
  if (
    input.effectiveKmStart != null &&
    input.effectiveKmEnd != null &&
    input.effectiveKmEnd < input.effectiveKmStart
  ) {
    throw new OperationalRecoveryError(
      "effectiveKmEnd cannot be less than effectiveKmStart",
      400,
    );
  }
}

function assertNoOpCorrect(
  correctionType: TripCorrectionType,
  changedFields: string[],
): void {
  if (
    correctionType === TRIP_CORRECTION_TYPE.CORRECT &&
    changedFields.length === 0
  ) {
    throw new OperationalRecoveryError(
      "Correct correction must change at least one operational field",
      400,
    );
  }
}

function buildMockCorrectionForPreview(params: {
  correctionType: TripCorrectionType;
  newEffectiveValues: TripOperationalValues;
  isVoid: boolean;
  input: CreateTripCorrectionInput;
  praemienImpact: PraemienImpact;
}): ITripCorrection {
  return {
    correctionType: params.correctionType,
    effectiveCountsTrip: params.isVoid ? 0 : params.newEffectiveValues.countsTrip,
    effectiveWasCancelled: params.newEffectiveValues.wasCancelled,
    effectiveCancelledAtPickup: params.newEffectiveValues.cancelledAtPickup,
    effectiveKmStart: params.newEffectiveValues.kmStart,
    effectiveKmEnd: params.newEffectiveValues.kmEnd,
    effectiveTimeWarning: params.newEffectiveValues.timeWarning,
    effectiveTimeAtHome: params.newEffectiveValues.timeAtHome,
    effectiveTimePickup: params.newEffectiveValues.timePickup,
    effectiveTimeArrival: params.newEffectiveValues.timeArrival,
    effectiveTimeEnd: params.newEffectiveValues.timeEnd,
    praemienImpact: params.praemienImpact,
    reason: params.input.reason,
  } as ITripCorrection;
}

async function verifyWorkerIdsInCompany(
  workerIds: string[] | undefined,
  companyId: string,
): Promise<void> {
  if (!workerIds || workerIds.length === 0) return;

  const objectIds = workerIds.map(
    (id) => new mongoose.Types.ObjectId(requireValidObjectId(id, "workerId")),
  );
  const users = await User.find({ _id: { $in: objectIds } }).select("companyId");

  const userById = new Map(users.map((u) => [String(u._id), u]));

  for (const workerId of workerIds) {
    const user = userById.get(workerId);
    if (!user) {
      throw new OperationalRecoveryError("Worker not found", 404);
    }
    if (user.companyId == null || String(user.companyId) !== companyId) {
      throw new OperationalRecoveryError(
        "Worker does not belong to your company",
        403,
      );
    }
  }
}

// ── Tenant verification ──────────────────────────────────────────────────────

function verifyTripTenant(
  tripCompanyId: mongoose.Types.ObjectId | null | undefined,
  adminCompanyId: string,
): void {
  if (tripCompanyId == null) {
    throw new OperationalRecoveryError(
      "Trip has no company scope (legacy record). Cannot be corrected via recovery.",
      403,
    );
  }
  if (String(tripCompanyId) !== adminCompanyId) {
    throw new OperationalRecoveryError(
      "Trip does not belong to your company",
      403,
    );
  }
}

async function verifyWorkdaySummaryTenantWhenProvided(
  workdaySummaryId: string | undefined,
  adminCompanyId: string,
  expectedAssignmentId?: string,
  expectedDate?: string,
): Promise<void> {
  if (!workdaySummaryId) return;

  const summary = await WorkdaySummary.findById(workdaySummaryId);
  if (!summary) {
    throw new OperationalRecoveryError("WorkdaySummary not found", 404);
  }

  if (summary.companyId == null) {
    throw new OperationalRecoveryError(
      "WorkdaySummary has no company scope (legacy record)",
      403,
    );
  }
  if (String(summary.companyId) !== adminCompanyId) {
    throw new OperationalRecoveryError(
      "WorkdaySummary does not belong to your company",
      403,
    );
  }

  if (expectedAssignmentId && summary.assignmentId !== expectedAssignmentId) {
    throw new OperationalRecoveryError(
      "WorkdaySummary assignmentId does not match correction context",
      400,
    );
  }
  if (expectedDate && summary.date !== expectedDate) {
    throw new OperationalRecoveryError(
      "WorkdaySummary date does not match correction context",
      400,
    );
  }
}

// ── Operational value helpers ─────────────────────────────────────────────────

function extractOriginalTripValues(trip: ITrip): TripOperationalValues {
  return {
    countsTrip: trip.countsTrip,
    wasCancelled: trip.wasCancelled,
    cancelledAtPickup: trip.cancelledAtPickup,
    kmStart: trip.kmStart,
    kmEnd: trip.kmEnd,
    timeWarning: trip.timeWarning,
    timeAtHome: trip.timeAtHome,
    timePickup: trip.timePickup,
    timeArrival: trip.timeArrival,
    timeEnd: trip.timeEnd,
  };
}

function extractEffectiveValuesFromCorrection(
  correction: ITripCorrection,
): TripOperationalValues {
  return {
    countsTrip: correction.effectiveCountsTrip ?? 0,
    wasCancelled: correction.effectiveWasCancelled ?? false,
    cancelledAtPickup: correction.effectiveCancelledAtPickup,
    kmStart: correction.effectiveKmStart,
    kmEnd: correction.effectiveKmEnd,
    timeWarning: correction.effectiveTimeWarning,
    timeAtHome: correction.effectiveTimeAtHome,
    timePickup: correction.effectiveTimePickup,
    timeArrival: correction.effectiveTimeArrival,
    timeEnd: correction.effectiveTimeEnd,
  };
}

function mergeEffectiveValues(
  base: TripOperationalValues,
  input: CreateTripCorrectionInput,
): TripOperationalValues {
  return {
    countsTrip:
      input.effectiveCountsTrip !== undefined
        ? input.effectiveCountsTrip
        : base.countsTrip,
    wasCancelled:
      input.effectiveWasCancelled !== undefined
        ? input.effectiveWasCancelled
        : base.wasCancelled,
    cancelledAtPickup:
      input.effectiveCancelledAtPickup !== undefined
        ? input.effectiveCancelledAtPickup
        : base.cancelledAtPickup,
    kmStart:
      input.effectiveKmStart !== undefined ? input.effectiveKmStart : base.kmStart,
    kmEnd: input.effectiveKmEnd !== undefined ? input.effectiveKmEnd : base.kmEnd,
    timeWarning:
      input.effectiveTimeWarning !== undefined
        ? input.effectiveTimeWarning
        : base.timeWarning,
    timeAtHome:
      input.effectiveTimeAtHome !== undefined
        ? input.effectiveTimeAtHome
        : base.timeAtHome,
    timePickup:
      input.effectiveTimePickup !== undefined
        ? input.effectiveTimePickup
        : base.timePickup,
    timeArrival:
      input.effectiveTimeArrival !== undefined
        ? input.effectiveTimeArrival
        : base.timeArrival,
    timeEnd:
      input.effectiveTimeEnd !== undefined ? input.effectiveTimeEnd : base.timeEnd,
  };
}

function buildTripSnapshot(
  assignmentId: string,
  date: string,
  values: TripOperationalValues,
  extras?: { correctionType?: TripCorrectionType; isEffectivelyVoided?: boolean },
): Record<string, unknown> {
  return {
    date,
    assignmentId,
    countsTrip: values.countsTrip,
    wasCancelled: values.wasCancelled,
    cancelledAtPickup: values.cancelledAtPickup ?? null,
    kmStart: values.kmStart ?? null,
    kmEnd: values.kmEnd ?? null,
    timeWarning: values.timeWarning ?? null,
    timeAtHome: values.timeAtHome ?? null,
    timePickup: values.timePickup ?? null,
    timeArrival: values.timeArrival ?? null,
    timeEnd: values.timeEnd ?? null,
    isEffectivelyVoided: extras?.isEffectivelyVoided ?? false,
    correctionType: extras?.correctionType ?? null,
  };
}

function computeChangedOperationalFields(
  before: TripOperationalValues,
  after: TripOperationalValues,
): string[] {
  const changed: string[] = [];
  const pairs: Array<[keyof TripOperationalValues, string]> = [
    ["countsTrip", "countsTrip"],
    ["wasCancelled", "wasCancelled"],
    ["cancelledAtPickup", "cancelledAtPickup"],
    ["kmStart", "kmStart"],
    ["kmEnd", "kmEnd"],
    ["timeWarning", "timeWarning"],
    ["timeAtHome", "timeAtHome"],
    ["timePickup", "timePickup"],
    ["timeArrival", "timeArrival"],
    ["timeEnd", "timeEnd"],
  ];

  for (const [key, label] of pairs) {
    if (before[key] !== after[key]) {
      changed.push(label);
    }
  }
  return changed;
}

function mapRecoveryAction(correctionType: TripCorrectionType): RecoveryActionType {
  switch (correctionType) {
    case TRIP_CORRECTION_TYPE.VOID:
      return RECOVERY_ACTION_TYPE.VOIDED;
    case TRIP_CORRECTION_TYPE.REPLACE:
      return RECOVERY_ACTION_TYPE.REPLACED;
    case TRIP_CORRECTION_TYPE.ADD_FORGOTTEN:
      return RECOVERY_ACTION_TYPE.ADMIN_OVERRIDE;
    case TRIP_CORRECTION_TYPE.CORRECT:
    default:
      return RECOVERY_ACTION_TYPE.CORRECTED;
  }
}

function isEffectivelyVoidedCorrection(
  correction: ITripCorrection | null,
): boolean {
  if (!correction) return false;
  return correction.correctionType === TRIP_CORRECTION_TYPE.VOID;
}

function buildEffectiveTripFromOriginal(
  trip: ITrip,
  activeCorrection: ITripCorrection | null,
): EffectiveTrip {
  const originalValues = extractOriginalTripValues(trip);
  const assignmentId = String(trip.assignmentId);
  const companyId = String(trip.companyId);

  if (!activeCorrection) {
    return {
      tripId: String(trip._id),
      assignmentId,
      date: trip.date,
      companyId,
      driver: String(trip.driver),
      medic: String(trip.medic),
      correctionType: null,
      isSynthetic: false,
      isEffectivelyVoided: false,
      isIncludedInEffectiveCount: originalValues.countsTrip === 1,
      hasCorrectedValues: false,
      activeCorrection: null,
      originalValues: null,
      ...originalValues,
    };
  }

  if (isEffectivelyVoidedCorrection(activeCorrection)) {
    return {
      tripId: String(trip._id),
      assignmentId,
      date: trip.date,
      companyId,
      driver: String(trip.driver),
      medic: String(trip.medic),
      correctionType: activeCorrection.correctionType,
      isSynthetic: false,
      isEffectivelyVoided: true,
      isIncludedInEffectiveCount: false,
      hasCorrectedValues: true,
      activeCorrection,
      originalValues,
      ...originalValues,
      countsTrip: 0,
    };
  }

  const effectiveValues = mergeEffectiveFromCorrection(originalValues, activeCorrection);

  return {
    tripId: String(trip._id),
    assignmentId,
    date: trip.date,
    companyId,
    driver: String(trip.driver),
    medic: String(trip.medic),
    correctionType: activeCorrection.correctionType,
    isSynthetic: false,
    isEffectivelyVoided: false,
    isIncludedInEffectiveCount: effectiveValues.countsTrip === 1,
    hasCorrectedValues: true,
    activeCorrection,
    originalValues,
    ...effectiveValues,
  };
}

function mergeEffectiveFromCorrection(
  originalValues: TripOperationalValues,
  correction: ITripCorrection,
): TripOperationalValues {
  return {
    countsTrip:
      correction.effectiveCountsTrip ?? originalValues.countsTrip,
    wasCancelled:
      correction.effectiveWasCancelled ?? originalValues.wasCancelled,
    cancelledAtPickup:
      correction.effectiveCancelledAtPickup ?? originalValues.cancelledAtPickup,
    kmStart: correction.effectiveKmStart ?? originalValues.kmStart,
    kmEnd: correction.effectiveKmEnd ?? originalValues.kmEnd,
    timeWarning: correction.effectiveTimeWarning ?? originalValues.timeWarning,
    timeAtHome: correction.effectiveTimeAtHome ?? originalValues.timeAtHome,
    timePickup: correction.effectiveTimePickup ?? originalValues.timePickup,
    timeArrival: correction.effectiveTimeArrival ?? originalValues.timeArrival,
    timeEnd: correction.effectiveTimeEnd ?? originalValues.timeEnd,
  };
}

function buildEffectiveTripFromForgottenCorrection(
  correction: ITripCorrection,
): EffectiveTrip {
  const effectiveValues = extractEffectiveValuesFromCorrection(correction);
  const workerIds = correction.workerIds ?? [];

  return {
    tripId: null,
    assignmentId: correction.assignmentId,
    date: correction.date,
    companyId: String(correction.companyId),
    driver: workerIds[0] ? String(workerIds[0]) : null,
    medic: workerIds[1] ? String(workerIds[1]) : null,
    correctionType: correction.correctionType,
    isSynthetic: true,
    isEffectivelyVoided: false,
    isIncludedInEffectiveCount: effectiveValues.countsTrip === 1,
    hasCorrectedValues: true,
    activeCorrection: correction,
    originalValues: null,
    ...effectiveValues,
  };
}

function collectWorkerIdsFromTrip(trip: ITrip): mongoose.Types.ObjectId[] {
  const ids: mongoose.Types.ObjectId[] = [];
  if (trip.driver) ids.push(new mongoose.Types.ObjectId(String(trip.driver)));
  if (trip.medic) ids.push(new mongoose.Types.ObjectId(String(trip.medic)));
  return ids;
}

function parseWorkerIds(workerIds: string[] | undefined): mongoose.Types.ObjectId[] | undefined {
  if (!workerIds || workerIds.length === 0) return undefined;
  return workerIds.map((id) => new mongoose.Types.ObjectId(requireValidObjectId(id, "workerId")));
}

function buildPreviewEffectiveTripsForWorkday(params: {
  currentTrips: EffectiveTrip[];
  trip: ITrip | null;
  originalTripId?: string;
  correctionType: TripCorrectionType;
  newEffectiveValues: TripOperationalValues;
  isVoid: boolean;
  companyId: string;
  assignmentId: string;
  date: string;
  workerIds?: mongoose.Types.ObjectId[];
}): EffectiveTrip[] {
  if (params.correctionType === TRIP_CORRECTION_TYPE.ADD_FORGOTTEN) {
    const workerIds = params.workerIds ?? [];
    return [
      ...params.currentTrips,
      {
        tripId: null,
        assignmentId: params.assignmentId,
        date: params.date,
        companyId: params.companyId,
        driver: workerIds[0] ? String(workerIds[0]) : null,
        medic: workerIds[1] ? String(workerIds[1]) : null,
        correctionType: TRIP_CORRECTION_TYPE.ADD_FORGOTTEN,
        isSynthetic: true,
        isEffectivelyVoided: false,
        isIncludedInEffectiveCount: params.newEffectiveValues.countsTrip === 1,
        hasCorrectedValues: true,
        activeCorrection: null,
        originalValues: null,
        ...params.newEffectiveValues,
      },
    ];
  }

  if (!params.trip || !params.originalTripId) {
    return params.currentTrips;
  }

  const previewCorrection = {
    correctionType: params.correctionType,
    effectiveCountsTrip: params.isVoid ? 0 : params.newEffectiveValues.countsTrip,
    effectiveWasCancelled: params.newEffectiveValues.wasCancelled,
    effectiveCancelledAtPickup: params.newEffectiveValues.cancelledAtPickup,
    effectiveKmStart: params.newEffectiveValues.kmStart,
    effectiveKmEnd: params.newEffectiveValues.kmEnd,
    effectiveTimeWarning: params.newEffectiveValues.timeWarning,
    effectiveTimeAtHome: params.newEffectiveValues.timeAtHome,
    effectiveTimePickup: params.newEffectiveValues.timePickup,
    effectiveTimeArrival: params.newEffectiveValues.timeArrival,
    effectiveTimeEnd: params.newEffectiveValues.timeEnd,
  } as ITripCorrection;

  return params.currentTrips.map((effectiveTrip) =>
    effectiveTrip.tripId === params.originalTripId
      ? buildEffectiveTripFromOriginal(params.trip!, previewCorrection)
      : effectiveTrip,
  );
}

// ── Shared prepare (preview + create) ─────────────────────────────────────────

interface PreparedTripCorrection {
  companyId: string;
  actorUserId: string;
  correctionType: TripCorrectionType;
  praemienImpact: PraemienImpact;
  assignmentId: string;
  date: string;
  originalTripId?: string;
  relatedWorkdaySummaryId?: string;
  trip: ITrip | null;
  workerIds?: mongoose.Types.ObjectId[];
  newEffectiveValues: TripOperationalValues;
  prevEffectiveValues: TripOperationalValues;
  changedFields: string[];
  previewEffectiveTrips: EffectiveTrip[];
  effectivePreview: EffectiveTrip;
  wouldSupersede: boolean;
  isVoid: boolean;
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  input: CreateTripCorrectionInput;
}

async function prepareTripCorrection(
  input: CreateTripCorrectionInput,
): Promise<PreparedTripCorrection> {
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const actorUserId = requireValidObjectId(input.actorUserId, "actorUserId");
  assertAdminRole(input.actorRole);
  requireNonEmptyString(input.reason, "reason");
  assertEffectiveKmRange(input);

  const correctionType = assertCorrectionType(input.correctionType);
  const praemienImpact = assertEnumImpact(
    input.praemienImpact,
    RECOVERY_PRAEMIEN_IMPACTS,
    "praemienImpact",
  ) as PraemienImpact;

  if (correctionType === TRIP_CORRECTION_TYPE.REPLACE) {
    throw new OperationalRecoveryError(
      "replace corrections are not supported in Phase 4.1",
      400,
    );
  }

  let trip: ITrip | null = null;
  let assignmentId = input.assignmentId?.trim();
  let date = input.date?.trim();
  let workerIds = parseWorkerIds(input.workerIds);
  let originalTripId: string | undefined;

  if (
    correctionType === TRIP_CORRECTION_TYPE.CORRECT ||
    correctionType === TRIP_CORRECTION_TYPE.VOID
  ) {
    originalTripId = requireValidObjectId(input.originalTripId, "originalTripId");
    trip = await Trip.findById(originalTripId);
    if (!trip) {
      throw new OperationalRecoveryError("Trip not found", 404);
    }

    verifyTripTenant(trip.companyId, companyId);

    if (!trip.sentInSummary) {
      throw new OperationalRecoveryError(
        "Only trips included in a closed workday summary are eligible for correction",
        400,
      );
    }

    assignmentId = String(trip.assignmentId);
    date = trip.date;
    workerIds = collectWorkerIdsFromTrip(trip);

    if (correctionType === TRIP_CORRECTION_TYPE.CORRECT && !hasAnyEffectiveField(input)) {
      throw new OperationalRecoveryError(
        "At least one effective field must be provided for correct corrections",
        400,
      );
    }
  } else if (correctionType === TRIP_CORRECTION_TYPE.ADD_FORGOTTEN) {
    assignmentId = requireNonEmptyString(input.assignmentId, "assignmentId");
    date = requireNonEmptyString(input.date, "date");
    if (!hasAnyEffectiveField(input)) {
      throw new OperationalRecoveryError(
        "At least one effective field must be provided for add_forgotten corrections",
        400,
      );
    }
    await verifyWorkerIdsInCompany(input.workerIds, companyId);
  }

  if (!assignmentId || !date) {
    throw new OperationalRecoveryError(
      "assignmentId and date are required",
      400,
    );
  }

  const relatedWorkdaySummaryId = requireOptionalObjectId(
    input.relatedWorkdaySummaryId,
    "relatedWorkdaySummaryId",
  );

  await verifyWorkdaySummaryTenantWhenProvided(
    relatedWorkdaySummaryId,
    companyId,
    assignmentId,
    date,
  );

  let wouldSupersede = false;
  let existingActiveCorrection: ITripCorrection | null = null;

  if (originalTripId) {
    existingActiveCorrection = await TripCorrection.findOne({
      originalTripId: new mongoose.Types.ObjectId(originalTripId),
      companyId: new mongoose.Types.ObjectId(companyId),
      status: TRIP_CORRECTION_STATUS.ACTIVE,
    });
    wouldSupersede = existingActiveCorrection != null;
  }

  const prevEffectiveValues: TripOperationalValues = trip
    ? existingActiveCorrection && !isEffectivelyVoidedCorrection(existingActiveCorrection)
      ? mergeEffectiveFromCorrection(
          extractOriginalTripValues(trip),
          existingActiveCorrection,
        )
      : extractOriginalTripValues(trip)
    : {
        countsTrip: 0,
        wasCancelled: false,
      };

  let newEffectiveValues: TripOperationalValues;
  let isVoid = false;

  if (correctionType === TRIP_CORRECTION_TYPE.VOID) {
    isVoid = true;
    newEffectiveValues = {
      ...prevEffectiveValues,
      countsTrip: 0,
    };
  } else if (correctionType === TRIP_CORRECTION_TYPE.ADD_FORGOTTEN) {
    newEffectiveValues = {
      countsTrip: input.effectiveCountsTrip ?? 1,
      wasCancelled: input.effectiveWasCancelled ?? false,
      cancelledAtPickup: input.effectiveCancelledAtPickup,
      kmStart: input.effectiveKmStart,
      kmEnd: input.effectiveKmEnd,
      timeWarning: input.effectiveTimeWarning,
      timeAtHome: input.effectiveTimeAtHome,
      timePickup: input.effectiveTimePickup,
      timeArrival: input.effectiveTimeArrival,
      timeEnd: input.effectiveTimeEnd,
    };
  } else {
    newEffectiveValues = mergeEffectiveValues(prevEffectiveValues, input);
  }

  const changedFields = computeChangedOperationalFields(
    prevEffectiveValues,
    newEffectiveValues,
  );
  assertNoOpCorrect(correctionType, changedFields);

  const beforeSnapshot = buildTripSnapshot(assignmentId, date, prevEffectiveValues, {
    correctionType: existingActiveCorrection?.correctionType,
    isEffectivelyVoided: isEffectivelyVoidedCorrection(existingActiveCorrection),
  });
  const afterSnapshot = buildTripSnapshot(assignmentId, date, newEffectiveValues, {
    correctionType,
    isEffectivelyVoided: isVoid,
  });

  const currentEffectiveTrips = await getEffectiveTripsForWorkday({
    companyId,
    assignmentId,
    date,
  });
  const previewEffectiveTrips = buildPreviewEffectiveTripsForWorkday({
    currentTrips: currentEffectiveTrips.trips,
    trip,
    originalTripId,
    correctionType,
    newEffectiveValues,
    isVoid,
    companyId,
    assignmentId,
    date,
    workerIds,
  });

  await validateTripWorkdayProjectionFeasibility({
    companyId,
    assignmentId,
    date,
    effectiveTrips: previewEffectiveTrips,
    relatedWorkdaySummaryId,
  });

  const mockCorrection = buildMockCorrectionForPreview({
    correctionType,
    newEffectiveValues,
    isVoid,
    input,
    praemienImpact,
  });

  let effectivePreview: EffectiveTrip;
  if (trip) {
    effectivePreview = buildEffectiveTripFromOriginal(trip, mockCorrection);
  } else {
    effectivePreview = buildEffectiveTripFromForgottenCorrection({
      ...mockCorrection,
      assignmentId,
      date,
      companyId: new mongoose.Types.ObjectId(companyId),
      workerIds,
      status: TRIP_CORRECTION_STATUS.ACTIVE,
    } as ITripCorrection);
  }

  return {
    companyId,
    actorUserId,
    correctionType,
    praemienImpact,
    assignmentId,
    date,
    originalTripId,
    relatedWorkdaySummaryId,
    trip,
    workerIds,
    newEffectiveValues,
    prevEffectiveValues,
    changedFields,
    previewEffectiveTrips,
    effectivePreview,
    wouldSupersede,
    isVoid,
    beforeSnapshot,
    afterSnapshot,
    input,
  };
}

/**
 * Preview a TripCorrection without persisting anything.
 */
export async function previewTripCorrection(
  input: CreateTripCorrectionInput,
): Promise<PreviewTripCorrectionResult> {
  const prepared = await prepareTripCorrection(input);
  const workdayProjection = await previewTripWorkdayProjection({
    companyId: prepared.companyId,
    assignmentId: prepared.assignmentId,
    date: prepared.date,
    effectiveTrips: prepared.previewEffectiveTrips,
    relatedWorkdaySummaryId: prepared.relatedWorkdaySummaryId,
  });

  return {
    effective: prepared.effectivePreview,
    changedFields: prepared.changedFields,
    wouldSupersedePreviousCorrection: prepared.wouldSupersede,
    workdayProjection,
    praemienImpact: prepared.praemienImpact,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a TripCorrection for an existing Trip or as a synthetic forgotten trip.
 *
 * Never mutates the original Trip document.
 */
export async function createTripCorrection(
  input: CreateTripCorrectionInput,
): Promise<CreateTripCorrectionResult> {
  const prepared = await prepareTripCorrection(input);
  const {
    companyId,
    actorUserId,
    correctionType,
    praemienImpact,
    assignmentId,
    date,
    originalTripId,
    relatedWorkdaySummaryId,
    trip,
    workerIds,
    newEffectiveValues,
    prevEffectiveValues,
    changedFields,
    previewEffectiveTrips: _previewEffectiveTrips,
    wouldSupersede: superseded,
    isVoid,
    beforeSnapshot,
    afterSnapshot,
  } = prepared;

  const relatedWorkdaySummaryCorrectionId = requireOptionalObjectId(
    input.relatedWorkdaySummaryCorrectionId,
    "relatedWorkdaySummaryCorrectionId",
  );

  if (originalTripId && superseded) {
    await TripCorrection.updateOne(
      {
        originalTripId: new mongoose.Types.ObjectId(originalTripId),
        companyId: new mongoose.Types.ObjectId(companyId),
        status: TRIP_CORRECTION_STATUS.ACTIVE,
      },
      { $set: { status: TRIP_CORRECTION_STATUS.SUPERSEDED } },
    );
  }

  const correction = await TripCorrection.create({
    companyId: new mongoose.Types.ObjectId(companyId),
    correctionType,
    status: TRIP_CORRECTION_STATUS.ACTIVE,
    originalTripId: originalTripId
      ? new mongoose.Types.ObjectId(originalTripId)
      : undefined,
    replacementTripId: (() => {
      const id = requireOptionalObjectId(input.replacementTripId, "replacementTripId");
      return id ? new mongoose.Types.ObjectId(id) : undefined;
    })(),
    assignmentId,
    date,
    workerIds,
    relatedWorkdaySummaryId: relatedWorkdaySummaryId
      ? new mongoose.Types.ObjectId(relatedWorkdaySummaryId)
      : undefined,
    relatedWorkdaySummaryCorrectionId: relatedWorkdaySummaryCorrectionId
      ? new mongoose.Types.ObjectId(relatedWorkdaySummaryCorrectionId)
      : undefined,
    effectiveCountsTrip: isVoid ? 0 : input.effectiveCountsTrip ?? newEffectiveValues.countsTrip,
    effectiveWasCancelled: isVoid
      ? prevEffectiveValues.wasCancelled
      : input.effectiveWasCancelled ?? newEffectiveValues.wasCancelled,
    effectiveCancelledAtPickup:
      input.effectiveCancelledAtPickup ?? newEffectiveValues.cancelledAtPickup,
    effectiveKmStart: input.effectiveKmStart ?? newEffectiveValues.kmStart,
    effectiveKmEnd: input.effectiveKmEnd ?? newEffectiveValues.kmEnd,
    effectiveTimeWarning: input.effectiveTimeWarning ?? newEffectiveValues.timeWarning,
    effectiveTimeAtHome: input.effectiveTimeAtHome ?? newEffectiveValues.timeAtHome,
    effectiveTimePickup: input.effectiveTimePickup ?? newEffectiveValues.timePickup,
    effectiveTimeArrival: input.effectiveTimeArrival ?? newEffectiveValues.timeArrival,
    effectiveTimeEnd: input.effectiveTimeEnd ?? newEffectiveValues.timeEnd,
    reason: input.reason.trim(),
    note: input.note?.trim() || undefined,
    actorUserId: new mongoose.Types.ObjectId(actorUserId),
    actorRole: input.actorRole,
    praemienImpact,
  });

  // ── Record audit event ────────────────────────────────────────────────────
  try {
    const entityId = originalTripId ?? String(correction._id);
    const recoveryEvent = await recordRecoveryEvent({
      companyId,
      moduleKey: MODULE_KEYS.WORKDAY,
      entityType: RECOVERY_ENTITY_TYPE.TRIP,
      entityId,
      entityLabel: originalTripId
        ? `Trip ${date} (${assignmentId})`
        : `Forgotten trip ${date} (${assignmentId})`,
      action: mapRecoveryAction(correctionType),
      actorUserId,
      actorRole: input.actorRole,
      reason: input.reason.trim(),
      beforeSummary: beforeSnapshot,
      afterSummary: afterSnapshot,
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      metadata: {
        source: "trip_recovery",
        correctionType,
        tripCorrectionId: String(correction._id),
        supersededPreviousCorrection: superseded,
      },
      severity: RECOVERY_SEVERITY.WARNING,
      relatedTripId: originalTripId,
      relatedWorkdaySummaryId: relatedWorkdaySummaryId,
      relatedAssignmentId: assignmentId,
      relatedDate: date,
      relatedWorkerId: workerIds?.[0] ? String(workerIds[0]) : undefined,
      praemienImpact,
    });

    await TripCorrection.updateOne(
      { _id: correction._id },
      { $set: { recoveryEventId: recoveryEvent._id } },
    );
    (correction as ITripCorrection).recoveryEventId =
      recoveryEvent._id as mongoose.Types.ObjectId;
  } catch (eventErr) {
    console.error(
      "[TripRecovery] Failed to record OperationalRecoveryEvent for correction",
      String(correction._id),
      eventErr,
    );
  }

  const refreshedCorrection = (await TripCorrection.findById(
    correction._id,
  )) as ITripCorrection;

  let effective: EffectiveTrip;
  if (trip) {
    effective = buildEffectiveTripFromOriginal(trip, refreshedCorrection);
  } else {
    effective = buildEffectiveTripFromForgottenCorrection(refreshedCorrection);
  }

  const effectiveTripsForWorkday = await getEffectiveTripsForWorkday({
    companyId,
    assignmentId,
    date,
  });

  const workdayProjection = await projectTripCorrectionToWorkday({
    companyId,
    assignmentId,
    date,
    actorUserId,
    actorRole: input.actorRole,
    tripCorrectionId: String(refreshedCorrection._id),
    praemienImpact,
    tripCorrectionReason: input.reason.trim(),
    effectiveTrips: effectiveTripsForWorkday.trips,
    relatedWorkdaySummaryId,
  });

  const linkedCorrection = (await TripCorrection.findById(
    refreshedCorrection._id,
  )) as ITripCorrection;

  return {
    correction: linkedCorrection,
    effective,
    superseded,
    workdayProjection,
  };
}

/**
 * Returns the effective view of a Trip.
 * Never mutates the original Trip.
 */
export async function getEffectiveTrip(
  input: GetEffectiveTripInput,
): Promise<EffectiveTrip> {
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const tripId = requireValidObjectId(input.tripId, "tripId");

  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new OperationalRecoveryError("Trip not found", 404);
  }

  verifyTripTenant(trip.companyId, companyId);

  const activeCorrection = await TripCorrection.findOne({
    originalTripId: new mongoose.Types.ObjectId(tripId),
    companyId: new mongoose.Types.ObjectId(companyId),
    status: TRIP_CORRECTION_STATUS.ACTIVE,
  });

  return buildEffectiveTripFromOriginal(trip, activeCorrection);
}

/**
 * Returns effective trips for a workday context (assignment + date).
 *
 * Includes synthetic add_forgotten corrections and excludes voided trips from
 * the effective count.
 */
export async function getEffectiveTripsForWorkday(
  input: GetEffectiveTripsForWorkdayInput,
): Promise<EffectiveTripsForWorkdayResult> {
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const assignmentId = requireNonEmptyString(input.assignmentId, "assignmentId");
  const date = requireNonEmptyString(input.date, "date");

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    throw new OperationalRecoveryError("assignmentId must be a valid ObjectId", 400);
  }

  const trips = await Trip.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId: new mongoose.Types.ObjectId(assignmentId),
    date,
  });

  const tripIds = trips.map((t) => t._id);
  const corrections = await TripCorrection.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    status: TRIP_CORRECTION_STATUS.ACTIVE,
    $or: [
      { originalTripId: { $in: tripIds } },
      {
        correctionType: TRIP_CORRECTION_TYPE.ADD_FORGOTTEN,
        assignmentId,
        date,
      },
    ],
  });

  const correctionByTripId = new Map<string, ITripCorrection>();
  const forgottenCorrections: ITripCorrection[] = [];

  for (const correction of corrections) {
    if (correction.correctionType === TRIP_CORRECTION_TYPE.ADD_FORGOTTEN) {
      forgottenCorrections.push(correction);
      continue;
    }
    if (correction.originalTripId) {
      correctionByTripId.set(String(correction.originalTripId), correction);
    }
  }

  const effectiveTrips: EffectiveTrip[] = trips.map((trip) =>
    buildEffectiveTripFromOriginal(
      trip,
      correctionByTripId.get(String(trip._id)) ?? null,
    ),
  );

  for (const forgotten of forgottenCorrections) {
    effectiveTrips.push(buildEffectiveTripFromForgottenCorrection(forgotten));
  }

  const effectiveTripCount = effectiveTrips.filter(
    (t) => t.isIncludedInEffectiveCount,
  ).length;

  return {
    assignmentId,
    date,
    trips: effectiveTrips,
    effectiveTripCount,
  };
}
