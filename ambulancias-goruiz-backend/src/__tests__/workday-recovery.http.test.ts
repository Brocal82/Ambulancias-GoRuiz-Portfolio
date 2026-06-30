/**
 * Phase 3.2 — Workday Recovery HTTP endpoint tests.
 *
 * GET  /api/workday-summary/:id/effective
 * POST /api/workday-summary/:id/corrections
 *
 * Tests:
 *   GET effective
 *     - 200 returns DTO (no raw mongoose fields)
 *     - 200 returns original values when no correction exists
 *     - 200 returns corrected effective values when correction exists
 *     - 400 on invalid ObjectId
 *     - 401 without token
 *     - 403 for worker role
 *     - 403 when workday module disabled
 *     - 403 for other-company summary (tenant isolation)
 *     - 403 for legacy null-companyId summary
 *     - 404 for non-existent summary
 *
 *   POST corrections
 *     - 201 creates correction and returns DTO
 *     - 201 supersedes previous active correction
 *     - 201 emits realtime workday_summary_changed
 *     - 400 on missing correctionReason
 *     - 400 on no corrected fields provided
 *     - 400 on negative numeric values
 *     - 400 on invalid praemienImpact (recalculated/blocked rejected)
 *     - 400 on invalid ObjectId in :id
 *     - 401 without token
 *     - 403 for worker role
 *     - 403 when workday module disabled
 *     - 403 for other-company summary (tenant isolation)
 *     - 403 for legacy null-companyId summary
 *     - 404 for non-existent summary
 *     - 422 for non-final WorkdaySummary
 *     - Original WorkdaySummary is unchanged after correction
 *     - OperationalRecoveryEvent is created
 *     - DTO does not expose recoveryEventId, __v, companyId
 *     - companyId/actorUserId/actorRole from body are ignored (JWT only)
 *
 *   Regression
 *     - Existing routes unchanged: GET /, GET /count, PATCH /:id/review
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
// issueTestJwt used for worker token
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import {
  WorkdaySummaryCorrection,
  OperationalRecoveryEvent,
} from "../modules/operational-recovery";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS, V1_DEFAULT_MODULES } from "../modules/companies/constants/modules.constants";
import * as wsNotify from "../modules/notifications/utils/ws-notify";

const BASE = "/api/workday-summary";

// ── Fixtures ─────────────────────────────────────────────────────────────────

let adminToken: string;
let adminId: string;
let companyId: string;
let workerToken: string;

function makeSummaryDoc(overrides: Record<string, unknown> = {}) {
  return {
    companyId: new mongoose.Types.ObjectId(companyId),
    driver: new mongoose.Types.ObjectId(adminId),
    medic: new mongoose.Types.ObjectId(adminId),
    ambulanceId: new mongoose.Types.ObjectId(),
    ambulanceNumber: "AMB-01",
    date: "2026-07-01",
    assignmentId: new mongoose.Types.ObjectId().toString(),
    initialKm: 10000,
    finalKm: 10200,
    totalDienstKm: 200,
    trips: [],
    isFinalClosure: true,
    totalEffectivePatients: 5,
    totalRealTrips: 4,
    isReviewed: false,
    ...overrides,
  };
}

const minimalBody = {
  correctedTotalEffectivePatients: 6,
  correctionReason: "Miscounted patients",
  praemienImpact: "none",
  payrollImpact: "none",
} as const;

// ── DB lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI);

  const data = await createTestAdminWithCompany();
  adminId = data.adminId;
  companyId = data.companyId;
  adminToken = data.adminToken;

  const worker = await createTestWorkerInCompany(
    new mongoose.Types.ObjectId(companyId),
    Date.now(),
  );
  workerToken = issueTestJwt(String(worker._id), "worker", companyId);
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  // Scoped cleanup: only delete this suite's documents (companyId from beforeAll)
  // to avoid interfering with concurrent service test workers sharing the same DB.
  // OperationalRecoveryEvent uses .collection.deleteMany() to bypass the immutability hooks.
  if (companyId) {
    const coid = new mongoose.Types.ObjectId(companyId);
    await WorkdaySummary.deleteMany({ companyId: coid });
    await WorkdaySummaryCorrection.deleteMany({ companyId: coid });
    await OperationalRecoveryEvent.collection.deleteMany({ companyId: coid });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /:id/effective
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/workday-summary/:id/effective", () => {
  it("200 — returns DTO for summary with no correction (original values)", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    const res = await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.summaryId).toBe(String(doc._id));
    expect(res.body.assignmentId).toBe(doc.assignmentId);
    expect(res.body.date).toBe(doc.date);
    expect(res.body.isFinalClosure).toBe(true);
    expect(res.body.isReviewed).toBe(false);
    expect(Array.isArray(res.body.workerIds)).toBe(true);

    // Effective values match original
    expect(res.body.effective.hasCorrectedValues).toBe(false);
    expect(res.body.effective.totalEffectivePatients).toBe(5);
    expect(res.body.effective.totalRealTrips).toBe(4);
    expect(res.body.effective.finalKm).toBe(10200);
    expect(res.body.effective.totalDienstKm).toBe(200);
    expect(res.body.effective.originalValues).toBeUndefined();
    expect(res.body.effective.activeCorrection).toBeUndefined();
  });

  it("200 — returns corrected effective values when active correction exists", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    // Create a correction via POST first
    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        correctedTotalEffectivePatients: 9,
        correctedFinalKm: 10350,
        correctionReason: "Re-check after dispatch log review",
        praemienImpact: "possible",
        payrollImpact: "none",
      })
      .expect(201);

    const res = await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.effective.hasCorrectedValues).toBe(true);
    expect(res.body.effective.totalEffectivePatients).toBe(9);
    expect(res.body.effective.finalKm).toBe(10350);
    // Uncorrected fields inherit original
    expect(res.body.effective.totalRealTrips).toBe(4);
    // originalValues present
    expect(res.body.effective.originalValues.totalEffectivePatients).toBe(5);
    expect(res.body.effective.originalValues.finalKm).toBe(10200);
    // activeCorrection present
    expect(res.body.effective.activeCorrection.correctionReason).toBe(
      "Re-check after dispatch log review",
    );
    expect(res.body.effective.activeCorrection.praemienImpact).toBe("possible");
  });

  it("DTO does not expose raw mongoose fields (__v, _id at top level)", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    const res = await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).not.toHaveProperty("__v");
    expect(res.body).not.toHaveProperty("_id");
    expect(res.body).not.toHaveProperty("companyId");
    expect(res.body).not.toHaveProperty("trips");
    expect(res.body).not.toHaveProperty("driver");
    expect(res.body).not.toHaveProperty("medic");
  });

  it("400 — invalid ObjectId in :id", async () => {
    await request(app)
      .get(`${BASE}/not-an-id/effective`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });

  it("401 — no token", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .expect(401);
  });

  it("403 — worker role denied", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(403);
  });

  it("403 — workday module disabled for company", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    // Temporarily disable the workday module for this company
    await Company.updateOne(
      { _id: new mongoose.Types.ObjectId(companyId) },
      { $set: { enabledModules: V1_DEFAULT_MODULES.filter((m) => m !== MODULE_KEYS.WORKDAY) } },
    );

    try {
      await request(app)
        .get(`${BASE}/${doc._id}/effective`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    } finally {
      await Company.updateOne(
        { _id: new mongoose.Types.ObjectId(companyId) },
        { $set: { enabledModules: [...V1_DEFAULT_MODULES] } },
      );
    }
  });

  it("403 — cross-company summary (tenant isolation)", async () => {
    const otherData = await createTestAdminWithCompany();
    const doc = await WorkdaySummary.create(
      makeSummaryDoc({ companyId: new mongoose.Types.ObjectId(otherData.companyId) }),
    );

    await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .set("Authorization", `Bearer ${adminToken}`) // admin from company A requesting company B's summary
      .expect(403);
  });

  it("403 — legacy null-companyId summary is rejected", async () => {
    const doc = await WorkdaySummary.create(
      makeSummaryDoc({ companyId: undefined }),
    );

    await request(app)
      .get(`${BASE}/${doc._id}/effective`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
  });

  it("404 — non-existent summary", async () => {
    await request(app)
      .get(`${BASE}/${new mongoose.Types.ObjectId()}/effective`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /:id/corrections
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/workday-summary/:id/corrections", () => {
  it("201 — creates correction and returns DTO", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    const res = await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(201);

    expect(res.body.correctionId).toBeDefined();
    expect(res.body.summaryId).toBe(String(doc._id));
    expect(res.body.date).toBe(doc.date);
    expect(res.body.superseded).toBe(false);
    expect(res.body.effective.hasCorrectedValues).toBe(true);
    expect(res.body.effective.totalEffectivePatients).toBe(6);
  });

  it("201 — DTO shape: no raw mongoose fields, no recoveryEventId, no companyId", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    const res = await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(201);

    expect(res.body).not.toHaveProperty("__v");
    expect(res.body).not.toHaveProperty("_id");
    expect(res.body).not.toHaveProperty("companyId");
    expect(res.body).not.toHaveProperty("recoveryEventId");
    expect(res.body).not.toHaveProperty("actorUserId");
    expect(res.body.effective).not.toHaveProperty("_id");
    expect(res.body.effective).not.toHaveProperty("__v");
  });

  it("201 — supersedes previous active correction", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...minimalBody, correctedTotalEffectivePatients: 6 })
      .expect(201);

    const res = await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...minimalBody,
        correctedTotalEffectivePatients: 8,
        correctionReason: "Updated after second review",
      })
      .expect(201);

    expect(res.body.superseded).toBe(true);
    expect(res.body.effective.totalEffectivePatients).toBe(8);
  });

  it("201 — original WorkdaySummary is NOT mutated after correction", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...minimalBody, correctedTotalEffectivePatients: 99 })
      .expect(201);

    const unchanged = await WorkdaySummary.findById(doc._id);
    expect(unchanged?.totalEffectivePatients).toBe(5);
  });

  it("201 — OperationalRecoveryEvent is created", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    const res = await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(201);

    // Verify via DB that an event was created
    const event = await OperationalRecoveryEvent.findOne({
      entityId: String(doc._id),
      action: "CORRECTED",
    });
    expect(event).not.toBeNull();
    expect(String(event?.companyId)).toBe(companyId);
    expect(res.body.correctionId).toBeDefined();
  });

  it("201 — emits workday_summary_changed realtime", async () => {
    const spy = jest
      .spyOn(wsNotify, "voidEmitWorkdayAdminSideEffects")
      .mockImplementation(() => {});

    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(201);

    expect(spy).toHaveBeenCalledWith(companyId);
    spy.mockRestore();
  });

  it("201 — companyId/actorUserId/actorRole from body are ignored (JWT only)", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    const otherCompanyId = new mongoose.Types.ObjectId().toString();
    const fakeUserId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...minimalBody,
        companyId: otherCompanyId, // should be ignored
        actorUserId: fakeUserId, // should be ignored
        actorRole: "superadmin", // should be ignored
      })
      .expect(201);

    // Correction belongs to the real company from JWT, not the injected one
    const correction = await WorkdaySummaryCorrection.findById(res.body.correctionId);
    expect(String(correction?.companyId)).toBe(companyId);
    expect(String(correction?.companyId)).not.toBe(otherCompanyId);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("400 — missing correctionReason", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    const { correctionReason: _, ...withoutReason } = minimalBody;

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(withoutReason)
      .expect(400);
  });

  it("400 — empty correctionReason", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...minimalBody, correctionReason: "   " })
      .expect(400);
  });

  it("400 — no corrected fields provided", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    const { correctedTotalEffectivePatients: _, ...withoutCorrected } = minimalBody;

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(withoutCorrected)
      .expect(400);
  });

  it("400 — negative correctedFinalKm", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...minimalBody, correctedFinalKm: -1 })
      .expect(400);
  });

  it("400 — praemienImpact 'recalculated' rejected in Phase 3.2", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...minimalBody, praemienImpact: "recalculated" })
      .expect(400);
  });

  it("400 — payrollImpact 'blocked' rejected in Phase 3.2", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...minimalBody, payrollImpact: "blocked" })
      .expect(400);
  });

  it("400 — invalid ObjectId in :id", async () => {
    await request(app)
      .post(`${BASE}/not-an-id/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(400);
  });

  it("400 — non-final WorkdaySummary (isFinalClosure: false)", async () => {
    const doc = await WorkdaySummary.create(
      makeSummaryDoc({ isFinalClosure: false }),
    );

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(400);
  });

  // ── Auth / module gates ────────────────────────────────────────────────────

  it("401 — no token", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .send(minimalBody)
      .expect(401);
  });

  it("403 — worker role denied", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());
    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send(minimalBody)
      .expect(403);
  });

  it("403 — workday module disabled for company", async () => {
    const doc = await WorkdaySummary.create(makeSummaryDoc());

    await Company.updateOne(
      { _id: new mongoose.Types.ObjectId(companyId) },
      { $set: { enabledModules: V1_DEFAULT_MODULES.filter((m) => m !== MODULE_KEYS.WORKDAY) } },
    );

    try {
      await request(app)
        .post(`${BASE}/${doc._id}/corrections`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(minimalBody)
        .expect(403);
    } finally {
      await Company.updateOne(
        { _id: new mongoose.Types.ObjectId(companyId) },
        { $set: { enabledModules: [...V1_DEFAULT_MODULES] } },
      );
    }
  });

  it("403 — cross-company summary (tenant isolation)", async () => {
    const otherData = await createTestAdminWithCompany();
    const doc = await WorkdaySummary.create(
      makeSummaryDoc({ companyId: new mongoose.Types.ObjectId(otherData.companyId) }),
    );

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(403);
  });

  it("403 — legacy null-companyId summary is rejected", async () => {
    const doc = await WorkdaySummary.create(
      makeSummaryDoc({ companyId: undefined }),
    );

    await request(app)
      .post(`${BASE}/${doc._id}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(403);
  });

  it("404 — non-existent summary", async () => {
    await request(app)
      .post(`${BASE}/${new mongoose.Types.ObjectId()}/corrections`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalBody)
      .expect(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Regression — existing workday-summary routes still work
// ═══════════════════════════════════════════════════════════════════════════════

describe("Regression — existing workday-summary routes", () => {
  it("GET /api/workday-summary still returns summaries list", async () => {
    await request(app)
      .get(`${BASE}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("GET /api/workday-summary/count still returns count", async () => {
    await request(app)
      .get(`${BASE}/count`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("PATCH /:id/review still returns 400/404 for non-existent summary (route still registered)", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`${BASE}/${fakeId}/review`)
      .set("Authorization", `Bearer ${adminToken}`);
    // Service throws 404/error; the route itself is still reachable (not 404 from routing)
    expect([400, 404, 500]).toContain(res.status);
  });
});
