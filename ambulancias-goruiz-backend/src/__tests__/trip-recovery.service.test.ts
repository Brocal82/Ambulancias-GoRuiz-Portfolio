/**
 * Phase 4.1 — Trip Recovery service tests.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { Trip } from "../modules/trips/models/trip.model";
import User from "../modules/users/models/user.model";
import {
  TripCorrection,
  OperationalRecoveryEvent,
  TRIP_CORRECTION_STATUS,
  TRIP_CORRECTION_TYPE,
  RECOVERY_PRAEMIEN_IMPACT,
  OperationalRecoveryError,
  createTripCorrection,
  getEffectiveTrip,
  getEffectiveTripsForWorkday,
} from "../modules/operational-recovery";

const FIXTURE_DATE = "2026-08-01";

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

function makeTripFixture(overrides: Record<string, unknown> = {}) {
  const companyId = makeObjectId();
  const driver = makeObjectId();
  const medic = makeObjectId();
  const assignmentId = makeObjectId();

  return {
    companyId,
    driver,
    medic,
    assignmentId,
    date: FIXTURE_DATE,
    auftragNumber: "AUF-001",
    patientName: "Secret Patient Name",
    fromAddress: "123 Hidden Street",
    toAddress: "456 Private Avenue",
    timeWarning: "08:00",
    timePickup: "08:30",
    timeArrival: "09:00",
    timeEnd: "09:45",
    kmStart: 10000,
    kmEnd: 10025,
    wasCancelled: false,
    countsTrip: 1 as const,
    reports: "Sensitive medical report content",
    sentInSummary: true,
    ...overrides,
  };
}

function makeMinimalCorrectionInput(
  companyId: string,
  originalTripId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    companyId,
    correctionType: TRIP_CORRECTION_TYPE.CORRECT,
    originalTripId,
    actorUserId: makeObjectId().toString(),
    actorRole: "admin",
    reason: "Operational correction after review",
    effectiveKmEnd: 10030,
    praemienImpact: RECOVERY_PRAEMIEN_IMPACT.POSSIBLE,
    ...overrides,
  };
}

describe("createTripCorrection", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await Trip.deleteMany({ date: FIXTURE_DATE });
    await TripCorrection.deleteMany({ date: FIXTURE_DATE });
    await OperationalRecoveryEvent.collection.deleteMany({});
    await User.deleteMany({ email: /@trip-recovery-test\.local$/ });
  });

  it("rejects missing companyId", async () => {
    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput("", makeObjectId().toString()) as Parameters<
          typeof createTripCorrection
        >[0],
      ),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });

  it("rejects invalid trip id", async () => {
    const companyId = makeObjectId().toString();
    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput(companyId, "not-valid") as Parameters<
          typeof createTripCorrection
        >[0],
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("originalTripId"),
    });
  });

  it("rejects non-existent trip id", async () => {
    const companyId = makeObjectId().toString();
    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput(companyId, makeObjectId().toString()) as Parameters<
          typeof createTripCorrection
        >[0],
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires reason", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id), {
          reason: "  ",
        }) as Parameters<typeof createTripCorrection>[0],
      ),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });

  it("requires admin role", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id), {
          actorRole: "worker",
        }) as Parameters<typeof createTripCorrection>[0],
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects correction for cross-company trip (tenant isolation)", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);
    const otherCompanyId = makeObjectId().toString();

    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput(otherCompanyId, String(trip._id)) as Parameters<
          typeof createTripCorrection
        >[0],
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("creates correction for same-company trip", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    const result = await createTripCorrection(
      makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id)) as Parameters<
        typeof createTripCorrection
      >[0],
    );

    expect(result.correction.status).toBe(TRIP_CORRECTION_STATUS.ACTIVE);
    expect(result.correction.correctionType).toBe(TRIP_CORRECTION_TYPE.CORRECT);
    expect(result.correction.effectiveKmEnd).toBe(10030);
    expect(result.correction.praemienImpact).toBe(RECOVERY_PRAEMIEN_IMPACT.POSSIBLE);
    expect(result.effective.hasCorrectedValues).toBe(true);
    expect(result.effective.kmEnd).toBe(10030);
  });

  it("does not mutate the original Trip document", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);
    const originalKmEnd = trip.kmEnd;
    const originalPatientName = trip.patientName;

    await createTripCorrection(
      makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id), {
        effectiveKmEnd: 10099,
      }) as Parameters<typeof createTripCorrection>[0],
    );

    const refreshed = await Trip.findById(trip._id);
    expect(refreshed?.kmEnd).toBe(originalKmEnd);
    expect(refreshed?.patientName).toBe(originalPatientName);
    expect(refreshed?.countsTrip).toBe(1);
  });

  it("returns original trip values when no correction exists", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    const effective = await getEffectiveTrip({
      companyId: String(fixture.companyId),
      tripId: String(trip._id),
    });

    expect(effective.hasCorrectedValues).toBe(false);
    expect(effective.kmEnd).toBe(10025);
    expect(effective.countsTrip).toBe(1);
  });

  it("returns active correction as effective trip values", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    await createTripCorrection(
      makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id), {
        effectiveCountsTrip: 0,
        effectiveKmEnd: 10040,
      }) as Parameters<typeof createTripCorrection>[0],
    );

    const effective = await getEffectiveTrip({
      companyId: String(fixture.companyId),
      tripId: String(trip._id),
    });

    expect(effective.hasCorrectedValues).toBe(true);
    expect(effective.countsTrip).toBe(0);
    expect(effective.kmEnd).toBe(10040);
    expect(effective.isIncludedInEffectiveCount).toBe(false);
  });

  it("supersedes previous active correction on second correction", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);
    const companyId = String(fixture.companyId);
    const tripId = String(trip._id);

    const first = await createTripCorrection(
      makeMinimalCorrectionInput(companyId, tripId, {
        effectiveKmEnd: 10050,
      }) as Parameters<typeof createTripCorrection>[0],
    );

    const second = await createTripCorrection(
      makeMinimalCorrectionInput(companyId, tripId, {
        effectiveKmEnd: 10060,
      }) as Parameters<typeof createTripCorrection>[0],
    );

    expect(second.superseded).toBe(true);

    const supersededDoc = await TripCorrection.findById(first.correction._id);
    expect(supersededDoc?.status).toBe(TRIP_CORRECTION_STATUS.SUPERSEDED);
    expect(second.correction.status).toBe(TRIP_CORRECTION_STATUS.ACTIVE);

    const effective = await getEffectiveTrip({ companyId, tripId });
    expect(effective.kmEnd).toBe(10060);
  });

  it("void correction removes trip from effective count/list", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);
    const companyId = String(fixture.companyId);
    const assignmentId = String(fixture.assignmentId);

    await createTripCorrection({
      companyId,
      correctionType: TRIP_CORRECTION_TYPE.VOID,
      originalTripId: String(trip._id),
      actorUserId: makeObjectId().toString(),
      actorRole: "admin",
      reason: "Duplicate trip entry",
      praemienImpact: RECOVERY_PRAEMIEN_IMPACT.NONE,
    });

    const effectiveTrip = await getEffectiveTrip({
      companyId,
      tripId: String(trip._id),
    });
    expect(effectiveTrip.isEffectivelyVoided).toBe(true);
    expect(effectiveTrip.isIncludedInEffectiveCount).toBe(false);
    expect(effectiveTrip.countsTrip).toBe(0);

    const workday = await getEffectiveTripsForWorkday({
      companyId,
      assignmentId,
      date: FIXTURE_DATE,
    });
    expect(workday.effectiveTripCount).toBe(0);
    expect(workday.trips[0]?.isEffectivelyVoided).toBe(true);
  });

  it("add_forgotten does not create a raw Trip document", async () => {
    const fixture = makeTripFixture();
    const companyId = String(fixture.companyId);
    const assignmentId = String(fixture.assignmentId);

    const driver = await User.create({
      email: `driver-${makeObjectId()}@trip-recovery-test.local`,
      password: "hashed",
      role: "worker",
      companyId: fixture.companyId,
      name: "Driver",
      lastName: "One",
    });
    const medic = await User.create({
      email: `medic-${makeObjectId()}@trip-recovery-test.local`,
      password: "hashed",
      role: "worker",
      companyId: fixture.companyId,
      name: "Medic",
      lastName: "One",
    });

    const tripCountBefore = await Trip.countDocuments({ date: FIXTURE_DATE });

    const result = await createTripCorrection({
      companyId,
      correctionType: TRIP_CORRECTION_TYPE.ADD_FORGOTTEN,
      assignmentId,
      date: FIXTURE_DATE,
      workerIds: [String(driver._id), String(medic._id)],
      actorUserId: makeObjectId().toString(),
      actorRole: "admin",
      reason: "Forgotten trip discovered in dispatch log",
      effectiveCountsTrip: 1,
      effectiveKmStart: 20000,
      effectiveKmEnd: 20015,
      praemienImpact: RECOVERY_PRAEMIEN_IMPACT.POSSIBLE,
    });

    const tripCountAfter = await Trip.countDocuments({ date: FIXTURE_DATE });
    expect(tripCountAfter).toBe(tripCountBefore);

    expect(result.effective.isSynthetic).toBe(true);
    expect(result.effective.tripId).toBeNull();
    expect(result.correction.originalTripId).toBeUndefined();

    const workday = await getEffectiveTripsForWorkday({
      companyId,
      assignmentId,
      date: FIXTURE_DATE,
    });
    expect(workday.effectiveTripCount).toBe(1);
    expect(workday.trips.some((t) => t.isSynthetic)).toBe(true);
  });

  it("creates an OperationalRecoveryEvent when correction is created", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    const result = await createTripCorrection(
      makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id)) as Parameters<
        typeof createTripCorrection
      >[0],
    );

    expect(result.correction.recoveryEventId).toBeDefined();

    const event = await OperationalRecoveryEvent.findById(
      result.correction.recoveryEventId,
    );
    expect(event).not.toBeNull();
    expect(event?.action).toBe("CORRECTED");
    expect(event?.entityType).toBe("TRIP");
    expect(event?.entityId).toBe(String(trip._id));
    expect(String(event?.companyId)).toBe(String(fixture.companyId));
    expect(event?.metadata?.source).toBe("trip_recovery");
    expect(event?.metadata?.correctionType).toBe(TRIP_CORRECTION_TYPE.CORRECT);
    expect(event?.praemienImpact).toBe(RECOVERY_PRAEMIEN_IMPACT.POSSIBLE);
  });

  it("recovery event snapshots are sanitized (no PII)", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    const result = await createTripCorrection(
      makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id), {
        effectiveKmEnd: 10035,
      }) as Parameters<typeof createTripCorrection>[0],
    );

    const event = await OperationalRecoveryEvent.findById(
      result.correction.recoveryEventId,
    );

    expect(event?.beforeSummary).toBeDefined();
    expect(event?.afterSummary).toBeDefined();
    expect(event?.beforeSummary).not.toHaveProperty("patientName");
    expect(event?.beforeSummary).not.toHaveProperty("fromAddress");
    expect(event?.beforeSummary).not.toHaveProperty("reports");
    expect(event?.afterSummary).not.toHaveProperty("patientName");
    expect(event?.afterSummary?.kmEnd).toBe(10035);
    expect(event?.beforeSummary?.kmEnd).toBe(10025);
  });

  it("does not leak corrections across companies", async () => {
    const fixtureA = makeTripFixture();
    const fixtureB = makeTripFixture();
    const tripA = await Trip.create(fixtureA);
    await Trip.create(fixtureB);

    await createTripCorrection(
      makeMinimalCorrectionInput(String(fixtureA.companyId), String(tripA._id), {
        effectiveKmEnd: 10100,
      }) as Parameters<typeof createTripCorrection>[0],
    );

    await expect(
      getEffectiveTrip({
        companyId: String(fixtureB.companyId),
        tripId: String(tripA._id),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects replace corrections in Phase 4.1", async () => {
    const fixture = makeTripFixture();
    const trip = await Trip.create(fixture);

    await expect(
      createTripCorrection(
        makeMinimalCorrectionInput(String(fixture.companyId), String(trip._id), {
          correctionType: TRIP_CORRECTION_TYPE.REPLACE,
        }) as Parameters<typeof createTripCorrection>[0],
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("replace"),
      statusCode: 400,
    });
  });
});
