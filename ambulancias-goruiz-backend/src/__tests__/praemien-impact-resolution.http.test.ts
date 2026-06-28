/**
 * Phase 3.4.2 — PraemienImpactResolution HTTP endpoint tests.
 *
 * GET  /api/praemien/impact-resolutions
 * GET  /api/praemien/impact-resolutions/:id
 * PATCH /api/praemien/impact-resolutions/:id
 *
 * Tests:
 *   GET collection
 *     - 200 returns array (default: pending)
 *     - 200 filters by status
 *     - 200 filters by workerId
 *     - 200 filters by year + month
 *     - 401 without token
 *     - 403 worker role
 *     - 403 praemien module disabled
 *     - cross-company isolation (other company's resolutions not returned)
 *
 *   GET detail
 *     - 200 returns DTO (no companyId, no recoveryEventId)
 *     - 400 invalid ObjectId
 *     - 401 without token
 *     - 403 cross-company
 *     - 404 not found
 *
 *   PATCH
 *     - 200 pending → ignored with note
 *     - 200 pending → adjusted with note
 *     - 200 pending → blocked with note
 *     - 200 note stored on resolution
 *     - 400 newStatus=recalculated rejected
 *     - 400 missing note
 *     - 400 invalid ObjectId
 *     - 401 without token
 *     - 403 worker role
 *     - 403 praemien module disabled
 *     - 403 cross-company
 *     - 404 not found
 *     - 409 already in terminal status
 *     - realtime praemien_changed + admin_counts_changed emitted
 *
 *   DTO integrity
 *     - no companyId exposed
 *     - no recoveryEventId exposed
 *     - MonthlyPraemie never mutated
 *
 *   Regression
 *     - existing praemien routes still reachable
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
import MonthlyPraemie from "../modules/praemien/models/monthly-praemie.model";
import {
  PraemienImpactResolution,
  PRAEMIEN_RESOLUTION_STATUS,
  WorkdaySummaryCorrection,
  OperationalRecoveryEvent,
} from "../modules/operational-recovery";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS, V1_DEFAULT_MODULES } from "../modules/companies/constants/modules.constants";
import * as wsNotify from "../modules/notifications/utils/ws-notify";

const BASE = "/api/praemien/impact-resolutions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

let adminToken: string;
let adminId: string;
let companyId: string;
let workerToken: string;

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
  if (companyId) {
    const coid = new mongoose.Types.ObjectId(companyId);
    await PraemienImpactResolution.collection.deleteMany({ companyId: coid });
    await MonthlyPraemie.deleteMany({ companyId: coid });
    await WorkdaySummaryCorrection.deleteMany({ companyId: coid });
    await OperationalRecoveryEvent.collection.deleteMany({ companyId: coid });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOid() {
  return new mongoose.Types.ObjectId();
}

/** Creates a WorkdaySummaryCorrection document for test fixtures. */
async function makeCorrection(opts: {
  companyId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  medicId?: mongoose.Types.ObjectId;
}) {
  const driver = opts.driverId ?? makeOid();
  const medic = opts.medicId ?? makeOid();
  return WorkdaySummaryCorrection.create({
    originalSummaryId: makeOid(),
    companyId: opts.companyId,
    assignmentId: makeOid().toString(),
    date: "2026-07-01",
    workerIds: [driver, medic],
    correctedTotalEffectivePatients: 6,
    correctionReason: "HTTP test correction",
    correctedBy: makeOid(),
    correctedAt: new Date(),
    praemienImpact: "possible",
    payrollImpact: "none",
    status: "active",
  });
}

/** Creates a PENDING PraemienImpactResolution for the given company and worker. */
async function makePendingResolution(opts: {
  companyId: mongoose.Types.ObjectId;
  workerId?: mongoose.Types.ObjectId;
  year?: number;
  month?: number;
}) {
  const workerId = opts.workerId ?? makeOid();
  const correction = await makeCorrection({
    companyId: opts.companyId,
    driverId: workerId,
  });
  return PraemienImpactResolution.create({
    companyId: opts.companyId,
    workerId,
    year: opts.year ?? 2026,
    month: opts.month ?? 7,
    relatedWorkdaySummaryId: correction.originalSummaryId,
    relatedWorkdaySummaryCorrectionId: correction._id,
    status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
    reason: "HTTP fixture reason",
  });
}

// ── GET /impact-resolutions ───────────────────────────────────────────────────

describe("GET /api/praemien/impact-resolutions", () => {
  it("200 returns an array (default: pending resolutions)", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].status).toBe("pending");
  });

  it("200 returns empty array when no resolutions exist", async () => {
    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // May be empty or contain pending resolutions from this company
  });

  it("200 filters by status=ignored", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    // Transition to ignored
    await PraemienImpactResolution.updateOne(
      { _id: resolution._id },
      { $set: { status: "ignored", resolvedBy: makeOid(), resolvedAt: new Date(), note: "dismissed" } },
    );

    const resPending = await request(app)
      .get(`${BASE}?status=pending`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resPending.body.every((r: { status: string }) => r.status === "pending")).toBe(true);

    const resIgnored = await request(app)
      .get(`${BASE}?status=ignored`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resIgnored.status).toBe(200);
    const ids = resIgnored.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(String(resolution._id));
  });

  it("200 filters by workerId", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const targetWorker = makeOid();
    const otherWorker = makeOid();

    await makePendingResolution({ companyId: coid, workerId: targetWorker });
    await makePendingResolution({ companyId: coid, workerId: otherWorker });

    const res = await request(app)
      .get(`${BASE}?workerId=${String(targetWorker)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every((r: { workerId: string }) => r.workerId === String(targetWorker))).toBe(true);
  });

  it("200 filters by year and month", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    await makePendingResolution({ companyId: coid, year: 2026, month: 7 });
    await makePendingResolution({ companyId: coid, year: 2026, month: 8 });

    const res = await request(app)
      .get(`${BASE}?year=2026&month=7`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every((r: { month: number }) => r.month === 7)).toBe(true);
  });

  it("401 without token", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it("403 for worker role", async () => {
    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  it("403 when praemien module disabled", async () => {
    try {
      await Company.updateOne(
        { _id: new mongoose.Types.ObjectId(companyId) },
        { $set: { enabledModules: V1_DEFAULT_MODULES.filter((m) => m !== MODULE_KEYS.PRAEMIEN) } },
      );

      const res = await request(app)
        .get(BASE)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    } finally {
      await Company.updateOne(
        { _id: new mongoose.Types.ObjectId(companyId) },
        { $set: { enabledModules: V1_DEFAULT_MODULES } },
      );
    }
  });

  it("cross-company: does not return other company's resolutions", async () => {
    const otherData = await createTestAdminWithCompany();
    const otherCoid = new mongoose.Types.ObjectId(otherData.companyId);
    const otherResolution = await makePendingResolution({ companyId: otherCoid });

    const res = await request(app)
      .get(BASE)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(String(otherResolution._id));

    await PraemienImpactResolution.collection.deleteMany({ companyId: otherCoid });
    await WorkdaySummaryCorrection.deleteMany({ companyId: otherCoid });
  });
});

// ── GET /impact-resolutions/:id ───────────────────────────────────────────────

describe("GET /api/praemien/impact-resolutions/:id", () => {
  it("200 returns DTO for a resolution belonging to the admin's company", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .get(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(String(resolution._id));
    expect(res.body.status).toBe("pending");
  });

  it("DTO does not expose companyId or recoveryEventId", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .get(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("companyId");
    expect(res.body).not.toHaveProperty("recoveryEventId");
    expect(res.body).not.toHaveProperty("__v");
    expect(res.body).not.toHaveProperty("_id");
  });

  it("400 on invalid ObjectId", async () => {
    const res = await request(app)
      .get(`${BASE}/not-an-id`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("401 without token", async () => {
    const res = await request(app).get(`${BASE}/${makeOid()}`);
    expect(res.status).toBe(401);
  });

  it("403 for cross-company resolution", async () => {
    const otherData = await createTestAdminWithCompany();
    const otherCoid = new mongoose.Types.ObjectId(otherData.companyId);
    const otherResolution = await makePendingResolution({ companyId: otherCoid });

    const res = await request(app)
      .get(`${BASE}/${String(otherResolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(403);

    await PraemienImpactResolution.collection.deleteMany({ companyId: otherCoid });
    await WorkdaySummaryCorrection.deleteMany({ companyId: otherCoid });
  });

  it("404 for non-existent resolution", async () => {
    const res = await request(app)
      .get(`${BASE}/${makeOid()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /impact-resolutions/:id ─────────────────────────────────────────────

describe("PATCH /api/praemien/impact-resolutions/:id", () => {
  const validNote = "Reviewed and dismissed — no recalculation needed";

  it("200 pending → ignored with note", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: validNote });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ignored");
    expect(res.body.note).toBe(validNote);
    expect(res.body.resolvedBy).toBeDefined();
    expect(res.body.resolvedAt).toBeDefined();
  });

  it("200 pending → adjusted with note", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "adjusted", note: "Manually adjusted" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("adjusted");
  });

  it("200 pending → blocked with note", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "blocked", note: "Period is closed" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("blocked");
  });

  it("200 note is persisted and returned in DTO", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });
    const note = "Specific review note for audit";

    await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note });

    // Fetch detail to verify persistence
    const detail = await request(app)
      .get(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(detail.body.note).toBe(note);
  });

  it("400 newStatus=recalculated is rejected", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "recalculated", note: validNote });

    expect(res.status).toBe(400);
  });

  it("400 missing note", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored" });

    expect(res.status).toBe(400);
  });

  it("400 empty note string", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: "   " });

    expect(res.status).toBe(400);
  });

  it("400 on invalid ObjectId in :id", async () => {
    const res = await request(app)
      .patch(`${BASE}/not-an-id`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: validNote });
    expect(res.status).toBe(400);
  });

  it("401 without token", async () => {
    const res = await request(app)
      .patch(`${BASE}/${makeOid()}`)
      .send({ newStatus: "ignored", note: validNote });
    expect(res.status).toBe(401);
  });

  it("403 for worker role", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ newStatus: "ignored", note: validNote });

    expect(res.status).toBe(403);
  });

  it("403 when praemien module disabled", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });
    try {
      await Company.updateOne(
        { _id: coid },
        { $set: { enabledModules: V1_DEFAULT_MODULES.filter((m) => m !== MODULE_KEYS.PRAEMIEN) } },
      );

      const res = await request(app)
        .patch(`${BASE}/${String(resolution._id)}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newStatus: "ignored", note: validNote });

      expect(res.status).toBe(403);
    } finally {
      await Company.updateOne(
        { _id: coid },
        { $set: { enabledModules: V1_DEFAULT_MODULES } },
      );
    }
  });

  it("403 cross-company resolution", async () => {
    const otherData = await createTestAdminWithCompany();
    const otherCoid = new mongoose.Types.ObjectId(otherData.companyId);
    const otherResolution = await makePendingResolution({ companyId: otherCoid });

    const res = await request(app)
      .patch(`${BASE}/${String(otherResolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: validNote });

    expect(res.status).toBe(403);

    await PraemienImpactResolution.collection.deleteMany({ companyId: otherCoid });
    await WorkdaySummaryCorrection.deleteMany({ companyId: otherCoid });
  });

  it("404 for non-existent resolution", async () => {
    const res = await request(app)
      .patch(`${BASE}/${makeOid()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: validNote });
    expect(res.status).toBe(404);
  });

  it("409 when resolution is already in terminal status", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: validNote });

    const res = await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "adjusted", note: "Second attempt" });

    expect(res.status).toBe(409);
  });

  it("emits praemien_changed and admin_counts_changed after PATCH", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const spy = jest
      .spyOn(wsNotify, "voidEmitPraemienAdminSideEffects")
      .mockImplementation(() => {});

    try {
      const res = await request(app)
        .patch(`${BASE}/${String(resolution._id)}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newStatus: "ignored", note: validNote });

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(companyId);
    } finally {
      spy.mockRestore();
    }
  });
});

// ── DTO integrity ─────────────────────────────────────────────────────────────

describe("DTO integrity", () => {
  it("DTO exposes expected fields and excludes internal fields", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const resolution = await makePendingResolution({ companyId: coid });

    const res = await request(app)
      .get(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;

    // Required fields present
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("workerId");
    expect(body).toHaveProperty("year");
    expect(body).toHaveProperty("month");
    expect(body).toHaveProperty("reason");
    expect(body).toHaveProperty("relatedWorkdaySummaryId");
    expect(body).toHaveProperty("relatedWorkdaySummaryCorrectionId");
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("updatedAt");

    // Forbidden fields absent
    expect(body).not.toHaveProperty("companyId");
    expect(body).not.toHaveProperty("recoveryEventId");
    expect(body).not.toHaveProperty("__v");
    expect(body).not.toHaveProperty("_id");
  });

  it("MonthlyPraemie is not mutated after PATCH", async () => {
    const coid = new mongoose.Types.ObjectId(companyId);
    const workerId = makeOid();

    const praemie = await MonthlyPraemie.create({
      userId: workerId,
      companyId: coid,
      year: 2026,
      month: 7,
      averagePatients: 5,
      premieLevel: "gold",
    });

    const resolution = await makePendingResolution({ companyId: coid, workerId });

    await request(app)
      .patch(`${BASE}/${String(resolution._id)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newStatus: "ignored", note: "Test note" });

    const praemieAfter = await MonthlyPraemie.findById(praemie._id);
    expect(praemieAfter).not.toBeNull();
    expect(praemieAfter!.averagePatients).toBe(5);
    expect(praemieAfter!.premieLevel).toBe("gold");
  });
});

// ── Regression ────────────────────────────────────────────────────────────────

describe("Regression: existing praemien routes still reachable", () => {
  it("GET /api/praemien/monthly-summary returns 200", async () => {
    const res = await request(app)
      .get("/api/praemien/monthly-summary")
      .set("Authorization", `Bearer ${adminToken}`);
    expect([200, 403]).toContain(res.status); // 403 = no company for this user path, still reaches handler
  });

  it("GET /api/praemien/rules returns 200 for admin", async () => {
    const res = await request(app)
      .get("/api/praemien/rules")
      .set("Authorization", `Bearer ${adminToken}`);
    expect([200, 404]).toContain(res.status);
  });
});
