/**
 * Phase 4.3 — Trip Recovery Admin API HTTP tests.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
} from "./test-helpers";
import { Trip } from "../modules/trips/models/trip.model";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import {
  TripCorrection,
  WorkdaySummaryCorrection,
  OperationalRecoveryEvent,
} from "../modules/operational-recovery";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS, V1_DEFAULT_MODULES } from "../modules/companies/constants/modules.constants";
import * as wsNotify from "../modules/notifications/utils/ws-notify";

const API = "/api/operational-recovery";
const FIXTURE_DATE = "2026-09-01";

let adminToken: string;
let adminId: string;
let companyId: string;
let workerToken: string;
let assignmentId: string;

function makeSummaryDoc(overrides: Record<string, unknown> = {}) {
  return {
    companyId: new mongoose.Types.ObjectId(companyId),
    driver: new mongoose.Types.ObjectId(adminId),
    medic: new mongoose.Types.ObjectId(adminId),
    ambulanceId: new mongoose.Types.ObjectId(),
    ambulanceNumber: "AMB-TRIP",
    date: FIXTURE_DATE,
    assignmentId,
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

function makeTripDoc(overrides: Record<string, unknown> = {}) {
  return {
    companyId: new mongoose.Types.ObjectId(companyId),
    driver: new mongoose.Types.ObjectId(adminId),
    medic: new mongoose.Types.ObjectId(adminId),
    assignmentId: new mongoose.Types.ObjectId(assignmentId),
    date: FIXTURE_DATE,
    auftragNumber: "AUF-TRIP",
    patientName: "Secret Patient",
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

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI);
  const data = await createTestAdminWithCompany();
  adminId = data.adminId;
  companyId = data.companyId;
  adminToken = data.adminToken;
  assignmentId = new mongoose.Types.ObjectId().toString();

  const worker = await createTestWorkerInCompany(
    new mongoose.Types.ObjectId(companyId),
    Date.now(),
  );
  workerToken = issueTestJwt(String(worker._id), "worker", companyId);
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
  if (companyId) {
    await Company.updateOne(
      { _id: new mongoose.Types.ObjectId(companyId) },
      { $set: { enabledModules: [...V1_DEFAULT_MODULES] } },
    );
  }
});

describe("POST /api/operational-recovery/trip-corrections/preview", () => {
  it("200 — preview correct returns safe DTO", async () => {
    await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    const res = await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "correct",
        originalTripId: String(trip._id),
        reason: "Fix km reading",
        effectiveKmEnd: 10030,
        praemienImpact: "possible",
      })
      .expect(200);

    expect(res.body.trip.type).toBe("corrected");
    expect(res.body.trip.values.kmEnd).toBe(10030);
    expect(res.body.workday.projectionStatus).toBe("applied");
    expect(res.body.praemienImpact).toBe("possible");
    expect(res.body.trip).not.toHaveProperty("patientName");
    expect(res.body).not.toHaveProperty("companyId");
    expect(res.body).not.toHaveProperty("recoveryEventId");
  });

  it("200 — preview void", async () => {
    await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    const res = await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "void",
        originalTripId: String(trip._id),
        reason: "Duplicate trip",
        praemienImpact: "none",
      })
      .expect(200);

    expect(res.body.trip.type).toBe("voided");
    expect(res.body.trip.isIncludedInEffectiveCount).toBe(false);
  });

  it("200 — preview add_forgotten", async () => {
    const summary = await WorkdaySummary.create(makeSummaryDoc());

    const res = await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "add_forgotten",
        workdaySummaryId: String(summary._id),
        reason: "Missed trip in closure",
        effectiveCountsTrip: 1,
        effectiveKmStart: 10100,
        effectiveKmEnd: 10120,
        praemienImpact: "possible",
      })
      .expect(200);

    expect(res.body.trip.type).toBe("forgotten");
    expect(res.body.trip.tripKey).toMatch(/^synthetic-/);
  });

  it("writes nothing and emits no realtime", async () => {
    const summary = await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    const tcBefore = await TripCorrection.countDocuments({});
    const wcBefore = await WorkdaySummaryCorrection.countDocuments({});
    const evBefore = await OperationalRecoveryEvent.countDocuments({});

    await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "correct",
        originalTripId: String(trip._id),
        reason: "Preview only",
        effectiveKmEnd: 10040,
        praemienImpact: "none",
      })
      .expect(200);

    expect(await TripCorrection.countDocuments({})).toBe(tcBefore);
    expect(await WorkdaySummaryCorrection.countDocuments({})).toBe(wcBefore);
    expect(await OperationalRecoveryEvent.countDocuments({})).toBe(evBefore);
    expect(wsNotify.voidEmitWorkdayAdminSideEffects).not.toHaveBeenCalled();
    expect(wsNotify.voidEmitWorkdayWorkerRefresh).not.toHaveBeenCalled();

    const tripAfter = await Trip.findById(trip._id);
    expect(tripAfter?.kmEnd).toBe(10025);
    const summaryAfter = await WorkdaySummary.findById(summary._id);
    expect(summaryAfter?.totalRealTrips).toBe(2);
  });

  it("400 — rejects no-op correct", async () => {
    await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "correct",
        originalTripId: String(trip._id),
        reason: "No change",
        effectiveKmEnd: 10025,
        praemienImpact: "none",
      })
      .expect(400);
  });

  it("400 — rejects kmEnd < kmStart", async () => {
    await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "correct",
        originalTripId: String(trip._id),
        reason: "Bad km",
        effectiveKmStart: 10050,
        effectiveKmEnd: 10040,
        praemienImpact: "none",
      })
      .expect(400);
  });

  it("403 — worker denied", async () => {
    const trip = await Trip.create(makeTripDoc());
    await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        correctionType: "void",
        originalTripId: String(trip._id),
        reason: "Nope",
        praemienImpact: "none",
      })
      .expect(403);
  });
});

describe("POST /api/operational-recovery/trip-corrections", () => {
  it("201 — create correct with Workday projection", async () => {
    const summary = await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    const res = await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "correct",
        originalTripId: String(trip._id),
        reason: "Correct km",
        effectiveCountsTrip: 0,
        praemienImpact: "possible",
      })
      .expect(201);

    expect(res.body.correction.id).toBeDefined();
    expect(res.body.correction.type).toBe("correct");
    expect(res.body.workday.workdaySummaryId).toBe(String(summary._id));
    expect(res.body.workday.projectionStatus).toBe("applied");
    expect(res.body).not.toHaveProperty("recoveryEventId");
    expect(res.body.correction).not.toHaveProperty("actorUserId");

    const wc = await WorkdaySummaryCorrection.findOne({
      originalSummaryId: summary._id,
      status: "active",
    });
    expect(wc).not.toBeNull();

    const event = await OperationalRecoveryEvent.findOne({
      entityType: "TRIP",
      entityId: String(trip._id),
    });
    expect(event).not.toBeNull();

    expect(wsNotify.voidEmitWorkdayAdminSideEffects).toHaveBeenCalled();
  });

  it("201 — create void", async () => {
    await WorkdaySummary.create(makeSummaryDoc());
    const trip = await Trip.create(makeTripDoc());

    const res = await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "void",
        originalTripId: String(trip._id),
        reason: "Void duplicate",
        praemienImpact: "none",
      })
      .expect(201);

    expect(res.body.trip.type).toBe("voided");
  });

  it("201 — create add_forgotten without new Trip document", async () => {
    const summary = await WorkdaySummary.create(makeSummaryDoc());
    const tripCountBefore = await Trip.countDocuments({ date: FIXTURE_DATE });

    const res = await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "add_forgotten",
        workdaySummaryId: String(summary._id),
        reason: "Forgotten trip",
        effectiveCountsTrip: 1,
        praemienImpact: "none",
      })
      .expect(201);

    expect(res.body.trip.type).toBe("forgotten");
    expect(await Trip.countDocuments({ date: FIXTURE_DATE })).toBe(tripCountBefore);
  });

  it("403 — cross-company trip rejected", async () => {
    const otherCompany = await Company.create({
      name: "Other Co",
      emailDomain: "@other.com",
      isActive: true,
      enabledModules: [...V1_DEFAULT_MODULES],
    });
    const trip = await Trip.create({
      ...makeTripDoc(),
      companyId: otherCompany._id,
    });
    await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "void",
        originalTripId: String(trip._id),
        reason: "Cross tenant",
        praemienImpact: "none",
      })
      .expect(403);
  });

  it("403 — cross-company WorkdaySummary rejected for add_forgotten", async () => {
    const otherCompany = await Company.create({
      name: "Other Co 2",
      emailDomain: "@other2.com",
      isActive: true,
      enabledModules: [...V1_DEFAULT_MODULES],
    });
    const otherSummary = await WorkdaySummary.create({
      ...makeSummaryDoc(),
      companyId: otherCompany._id,
    });

    await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "add_forgotten",
        workdaySummaryId: String(otherSummary._id),
        reason: "Cross tenant summary",
        effectiveCountsTrip: 1,
        praemienImpact: "none",
      })
      .expect(403);
  });

  it("403 — legacy null-company WorkdaySummary rejected", async () => {
    const legacyAssignmentId = new mongoose.Types.ObjectId().toString();
    const summary = await WorkdaySummary.create({
      ...makeSummaryDoc({ assignmentId: legacyAssignmentId }),
      companyId: null,
    });

    await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "add_forgotten",
        workdaySummaryId: String(summary._id),
        reason: "Legacy summary",
        effectiveCountsTrip: 1,
        praemienImpact: "none",
      })
      .expect(403);
  });

  it("403 — workday module disabled", async () => {
    await Company.updateOne(
      { _id: new mongoose.Types.ObjectId(companyId) },
      { $set: { enabledModules: V1_DEFAULT_MODULES.filter((m) => m !== MODULE_KEYS.WORKDAY) } },
    );
    const trip = await Trip.create(makeTripDoc());

    await request(app)
      .post(`${API}/trip-corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "void",
        originalTripId: String(trip._id),
        reason: "Module off",
        praemienImpact: "none",
      })
      .expect(403);
  });
});

describe("GET /api/operational-recovery/workday-summaries/:workdaySummaryId/effective-trips", () => {
  it("200 — returns effective trips anchored by WorkdaySummary", async () => {
    const summary = await WorkdaySummary.create(makeSummaryDoc());
    await Trip.create(makeTripDoc());
    await Trip.create(makeTripDoc({ kmStart: 10025, kmEnd: 10050, timePickup: "11:00" }));

    const res = await request(app)
      .get(`${API}/workday-summaries/${summary._id}/effective-trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.workdaySummaryId).toBe(String(summary._id));
    expect(res.body.trips).toHaveLength(2);
    expect(res.body.effectiveTripCount).toBe(2);
    expect(res.body.trips[0]).not.toHaveProperty("patientName");
    expect(res.body).not.toHaveProperty("companyId");
  });

  it("403 — cross-company WorkdaySummary", async () => {
    const otherCompany = await Company.create({
      name: "Other Co 3",
      emailDomain: "@other3.com",
      isActive: true,
      enabledModules: [...V1_DEFAULT_MODULES],
    });
    const summary = await WorkdaySummary.create({
      ...makeSummaryDoc(),
      companyId: otherCompany._id,
    });

    await request(app)
      .get(`${API}/workday-summaries/${summary._id}/effective-trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
  });
});

describe("Trip Recovery API validation", () => {
  it("400 — replace correction type rejected by schema", async () => {
    const trip = await Trip.create(makeTripDoc());
    await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "replace",
        originalTripId: String(trip._id),
        reason: "Replace",
        praemienImpact: "none",
      })
      .expect(400);
  });

  it("400 — rejects forbidden body fields (companyId)", async () => {
    const trip = await Trip.create(makeTripDoc());
    await request(app)
      .post(`${API}/trip-corrections/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctionType: "void",
        originalTripId: String(trip._id),
        reason: "Test",
        praemienImpact: "none",
        companyId: "000000000000000000000000",
      })
      .expect(400);
  });
});
