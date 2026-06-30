/**
 * Phase 4.2 — Trip → Workday projection integration tests.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { Trip } from "../modules/trips/models/trip.model";
import User from "../modules/users/models/user.model";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import * as wsNotify from "../modules/notifications/utils/ws-notify";
import {
  TripCorrection,
  WorkdaySummaryCorrection,
  OperationalRecoveryEvent,
  TRIP_CORRECTION_TYPE,
  CORRECTION_STATUS,
  RECOVERY_PRAEMIEN_IMPACT,
  RECOVERY_PAYROLL_IMPACT,
  OperationalRecoveryError,
  createTripCorrection,
  createWorkdaySummaryCorrection,
  getEffectiveWorkdaySummary,
} from "../modules/operational-recovery";

const FIXTURE_DATE = "2026-08-15";

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

function makeSummaryFixture(overrides: Record<string, unknown> = {}) {
  const companyId = makeObjectId();
  const driver = makeObjectId();
  const medic = makeObjectId();
  const assignmentId = makeObjectId().toString();

  return {
    companyId,
    driver,
    medic,
    assignmentId,
    ambulanceId: makeObjectId(),
    ambulanceNumber: "AMB-100",
    date: FIXTURE_DATE,
    initialKm: 10000,
    finalKm: 10200,
    totalDienstKm: 200,
    trips: [],
    isFinalClosure: true,
    totalEffectivePatients: 2,
    totalRealTrips: 2,
    isReviewed: false,
    startTime: "08:00",
    ...overrides,
  };
}

function makeTripFixture(
  companyId: mongoose.Types.ObjectId,
  assignmentId: mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  return {
    companyId,
    driver: makeObjectId(),
    medic: makeObjectId(),
    assignmentId,
    date: FIXTURE_DATE,
    auftragNumber: "AUF-100",
    patientName: "Hidden Patient",
    fromAddress: "Hidden From",
    toAddress: "Hidden To",
    timeWarning: "08:00",
    timePickup: "09:00",
    kmStart: 10000,
    kmEnd: 10025,
    wasCancelled: false,
    countsTrip: 1 as const,
    sentInSummary: true,
    ...overrides,
  };
}

function makeCorrectionInput(companyId: string, originalTripId: string) {
  return {
    companyId,
    correctionType: TRIP_CORRECTION_TYPE.CORRECT,
    originalTripId,
    actorUserId: makeObjectId().toString(),
    actorRole: "admin",
    reason: "Trip operational correction",
    effectiveCountsTrip: 0 as const,
    praemienImpact: RECOVERY_PRAEMIEN_IMPACT.POSSIBLE,
  };
}

describe("Trip → Workday projection (Phase 4.2)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(() => {
    jest.spyOn(wsNotify, "voidEmitWorkdayAdminSideEffects").mockImplementation(() => {});
    jest.spyOn(wsNotify, "voidEmitWorkdayWorkerRefresh").mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Trip.deleteMany({ date: FIXTURE_DATE });
    await WorkdaySummary.deleteMany({ date: FIXTURE_DATE });
    await TripCorrection.deleteMany({ date: FIXTURE_DATE });
    await WorkdaySummaryCorrection.deleteMany({ date: FIXTURE_DATE });
    await OperationalRecoveryEvent.collection.deleteMany({});
    await User.deleteMany({ email: /@phase42-test\.local$/ });
  });

  it("creates WorkdaySummaryCorrection after trip correction on final WorkdaySummary", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    const trip = await Trip.create(
      makeTripFixture(fixture.companyId, new mongoose.Types.ObjectId(fixture.assignmentId)),
    );

    const result = await createTripCorrection(
      makeCorrectionInput(String(fixture.companyId), String(trip._id)),
    );

    expect(result.workdayProjection.skipped).toBe(false);
    expect(result.workdayProjection.workdaySummaryCorrectionId).toBeDefined();

    const linked = await TripCorrection.findById(result.correction._id);
    expect(String(linked?.relatedWorkdaySummaryId)).toBe(String(summary._id));
    expect(linked?.relatedWorkdaySummaryCorrectionId).toBeDefined();

    const workdayCorrection = await WorkdaySummaryCorrection.findById(
      result.workdayProjection.workdaySummaryCorrectionId,
    );
    expect(workdayCorrection?.status).toBe(CORRECTION_STATUS.ACTIVE);
    expect(workdayCorrection?.correctedTotalRealTrips).toBe(0);

    const effective = await getEffectiveWorkdaySummary({
      companyId: String(fixture.companyId),
      workdaySummaryId: String(summary._id),
    });
    expect(effective.totalRealTrips).toBe(0);
    expect(effective.hasCorrectedValues).toBe(true);

    const workdayEvent = await OperationalRecoveryEvent.findOne({
      entityType: "WORKDAY_SUMMARY",
      entityId: String(summary._id),
    }).sort({ createdAt: -1 });
    expect(workdayEvent?.metadata?.source).toBe("trip_recovery_projection");
  });

  it("skips WorkdaySummaryCorrection when no final WorkdaySummary exists", async () => {
    const companyId = makeObjectId();
    const assignmentId = makeObjectId();
    const trip = await Trip.create(makeTripFixture(companyId, assignmentId));

    const result = await createTripCorrection(
      makeCorrectionInput(String(companyId), String(trip._id)),
    );

    expect(result.workdayProjection.skipped).toBe(true);
    expect(result.workdayProjection.skipReason).toBe("no_final_workday_summary");

    const workdayCorrections = await WorkdaySummaryCorrection.countDocuments({
      companyId,
    });
    expect(workdayCorrections).toBe(0);
  });

  it("supersedes previous WorkdaySummaryCorrection on second trip correction", async () => {
    const fixture = makeSummaryFixture({ totalRealTrips: 2, totalEffectivePatients: 2 });
    const summary = await WorkdaySummary.create(fixture);
    const assignmentOid = new mongoose.Types.ObjectId(fixture.assignmentId);

    const tripA = await Trip.create(makeTripFixture(fixture.companyId, assignmentOid));
    const tripB = await Trip.create(
      makeTripFixture(fixture.companyId, assignmentOid, {
        kmStart: 10025,
        kmEnd: 10050,
        timePickup: "11:00",
      }),
    );

    const companyId = String(fixture.companyId);

    const first = await createTripCorrection(makeCorrectionInput(companyId, String(tripA._id)));
    const second = await createTripCorrection(makeCorrectionInput(companyId, String(tripB._id)));

    expect(second.workdayProjection.supersededWorkdayCorrection).toBe(true);

    const corrections = await WorkdaySummaryCorrection.find({
      originalSummaryId: summary._id,
    }).sort({ createdAt: 1 });

    expect(corrections).toHaveLength(2);
    expect(corrections[0]?.status).toBe(CORRECTION_STATUS.SUPERSEDED);
    expect(corrections[1]?.status).toBe(CORRECTION_STATUS.ACTIVE);
    expect(corrections[1]?.correctedTotalRealTrips).toBe(0);
  });

  it("does not mutate original Trip or WorkdaySummary documents", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    const trip = await Trip.create(
      makeTripFixture(fixture.companyId, new mongoose.Types.ObjectId(fixture.assignmentId)),
    );

    const originalTripKm = trip.kmEnd;
    const originalSummaryTrips = summary.totalRealTrips;

    await createTripCorrection(
      makeCorrectionInput(String(fixture.companyId), String(trip._id)),
    );

    const tripAfter = await Trip.findById(trip._id);
    const summaryAfter = await WorkdaySummary.findById(summary._id);

    expect(tripAfter?.kmEnd).toBe(originalTripKm);
    expect(summaryAfter?.totalRealTrips).toBe(originalSummaryTrips);
  });

  it("rejects cross-company relatedWorkdaySummaryId", async () => {
    const fixture = makeSummaryFixture();
    const trip = await Trip.create(
      makeTripFixture(fixture.companyId, new mongoose.Types.ObjectId(fixture.assignmentId)),
    );
    const otherSummary = await WorkdaySummary.create(makeSummaryFixture());

    await expect(
      createTripCorrection({
        ...makeCorrectionInput(String(fixture.companyId), String(trip._id)),
        relatedWorkdaySummaryId: String(otherSummary._id),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects add_forgotten with cross-company workerIds", async () => {
    const fixture = makeSummaryFixture();
    await WorkdaySummary.create(fixture);
    const otherCompanyWorker = await User.create({
      email: `worker-${makeObjectId()}@phase42-test.local`,
      password: "hashed",
      role: "worker",
      companyId: makeObjectId(),
      name: "Other",
      lastName: "Worker",
    });

    await expect(
      createTripCorrection({
        companyId: String(fixture.companyId),
        correctionType: TRIP_CORRECTION_TYPE.ADD_FORGOTTEN,
        assignmentId: fixture.assignmentId,
        date: FIXTURE_DATE,
        workerIds: [String(otherCompanyWorker._id)],
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        reason: "Forgotten trip",
        effectiveCountsTrip: 1,
        praemienImpact: RECOVERY_PRAEMIEN_IMPACT.NONE,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("emits workday realtime helpers after projection", async () => {
    const fixture = makeSummaryFixture();
    await WorkdaySummary.create(fixture);
    const trip = await Trip.create(
      makeTripFixture(fixture.companyId, new mongoose.Types.ObjectId(fixture.assignmentId)),
    );

    await createTripCorrection(makeCorrectionInput(String(fixture.companyId), String(trip._id)));

    expect(wsNotify.voidEmitWorkdayAdminSideEffects).toHaveBeenCalledWith(
      String(fixture.companyId),
    );
    expect(wsNotify.voidEmitWorkdayWorkerRefresh).toHaveBeenCalled();
  });

  it("blocks trip km projection when manual Workday km correction is active", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    const trip = await Trip.create(
      makeTripFixture(fixture.companyId, new mongoose.Types.ObjectId(fixture.assignmentId), {
        effectiveKmEnd: undefined,
      }),
    );
    const companyId = String(fixture.companyId);

    await createWorkdaySummaryCorrection({
      companyId,
      workdaySummaryId: String(summary._id),
      actorUserId: makeObjectId().toString(),
      actorRole: "admin",
      correctedFinalKm: 10300,
      correctedTotalDienstKm: 300,
      correctionReason: "Manual km adjustment",
      praemienImpact: RECOVERY_PRAEMIEN_IMPACT.NONE,
      payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
    });

    await expect(
      createTripCorrection({
        ...makeCorrectionInput(companyId, String(trip._id)),
        effectiveKmEnd: 10099,
      }),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);

    const tripCorrectionCount = await TripCorrection.countDocuments({ companyId });
    expect(tripCorrectionCount).toBe(0);
  });
});
