/**
 * Phase 2.3 — Absence Cleanup Monitor: HTTP endpoint tests.
 *
 * Tests:
 *   GET  /api/operational-recovery/absence-cleanup
 *     - 200 returns inconsistencies array + scannedAt
 *     - 200 with fromDate/toDate query params
 *     - 400 on invalid date query params
 *     - 401 without token
 *     - 403 for worker role
 *     - 403 when scheduling module disabled
 *     - Tenant isolation: only sees own company data
 *
 *   POST /api/operational-recovery/absence-cleanup/repair
 *     - 200 repairs selected items
 *     - 400 on empty items array
 *     - 400 on invalid ObjectId
 *     - 401 without token
 *     - 403 for worker role
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
import { Dienst } from "../modules/diensts";
import User from "../modules/users/models/user.model";
import VacationRequest from "../modules/vacation/models/vacation-request.model";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";
import Company from "../modules/companies/models/company.model";
import {
  MODULE_KEYS,
  V1_DEFAULT_MODULES,
} from "../modules/companies/constants/modules.constants";

const API = "/api/operational-recovery";

// ── Helpers ───────────────────────────────────────────────────────────────────

let emailSeq = 0;
function uniqueEmail() {
  return `acm-http-${Date.now()}-${++emailSeq}@goruiz.test`;
}

async function makeWorker(companyId: mongoose.Types.ObjectId) {
  return User.create({
    name: "Test",
    lastName: "Worker",
    email: uniqueEmail(),
    password: "hashedpw",
    role: "worker",
    companyId,
  });
}

async function makeVacation(
  userId: mongoose.Types.ObjectId,
  opts: { start?: string; end?: string; status?: string } = {},
) {
  return VacationRequest.create({
    user: userId,
    startDate: new Date(opts.start ?? "2026-06-10"),
    endDate: new Date(opts.end ?? "2026-06-15"),
    status: opts.status ?? "accepted",
  });
}

async function makeDienstWithDriver(
  companyId: mongoose.Types.ObjectId,
  driverId: mongoose.Types.ObjectId,
  date: string,
) {
  return Dienst.create({
    companyId,
    dienstNumber: Math.floor(Math.random() * 9000) + 1000,
    assignments: [
      {
        date,
        startTime: "08:00",
        endTime: "16:00",
        driver: driverId,
      },
    ],
  });
}

// ── DB lifecycle ──────────────────────────────────────────────────────────────

let adminToken: string;
let adminId: string;
let companyId: string;
let workerToken: string;
let workerId: string;

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI);

  const adminData = await createTestAdminWithCompany();
  adminToken = adminData.adminToken;
  adminId = adminData.adminId;
  companyId = adminData.companyId;

  const worker = await createTestWorkerInCompany(
    new mongoose.Types.ObjectId(companyId),
    Date.now(),
  );
  workerId = String(worker._id);
  workerToken = issueTestJwt(workerId, "worker", companyId);
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /@goruiz\.test$/ }),
    Dienst.deleteMany({ dienstNumber: { $gte: 1000 } }),
    VacationRequest.deleteMany({}),
    SickLeave.deleteMany({}),
  ]);
});

// ── GET /api/operational-recovery/absence-cleanup ─────────────────────────────

describe("GET /api/operational-recovery/absence-cleanup", () => {
  it("returns 200 with empty inconsistencies when none exist", async () => {
    const res = await request(app)
      .get(`${API}/absence-cleanup`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("inconsistencies");
    expect(Array.isArray(res.body.inconsistencies)).toBe(true);
    expect(res.body).toHaveProperty("scannedAt");
  });

  it("detects a stale assignment and returns it", async () => {
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await makeWorker(companyOid);
    await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienstWithDriver(
      companyOid,
      worker._id as mongoose.Types.ObjectId,
      "2026-06-12",
    );

    const res = await request(app)
      .get(`${API}/absence-cleanup`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const found = (
      res.body.inconsistencies as Array<{ workerId: string }>
    ).find((inc) => inc.workerId === String(worker._id));
    expect(found).toBeDefined();
  });

  it("accepts fromDate and toDate query params", async () => {
    const res = await request(app)
      .get(`${API}/absence-cleanup?fromDate=2026-06-01&toDate=2026-06-30`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.inconsistencies)).toBe(true);
  });

  it("returns 400 on invalid date query params", async () => {
    const res = await request(app)
      .get(`${API}/absence-cleanup?fromDate=not-a-date`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 without token", async () => {
    await request(app)
      .get(`${API}/absence-cleanup`)
      .expect(401);
  });

  it("returns 403 for worker role", async () => {
    await request(app)
      .get(`${API}/absence-cleanup`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(403);
  });

  it("returns 403 when scheduling module is disabled", async () => {
    const modulesWithoutScheduling = V1_DEFAULT_MODULES.filter(
      (m) => m !== MODULE_KEYS.SCHEDULING,
    );
    await Company.findByIdAndUpdate(companyId, {
      enabledModules: modulesWithoutScheduling,
    });

    const res = await request(app)
      .get(`${API}/absence-cleanup`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);

    expect(res.body).toHaveProperty("message");

    // Restore
    await Company.findByIdAndUpdate(companyId, {
      enabledModules: V1_DEFAULT_MODULES,
    });
  });

  it("does NOT return inconsistencies from another company (tenant isolation)", async () => {
    // Set up a second company with a stale assignment
    const otherCompany = await Company.create({
      name: "Other Company",
      emailDomain: "@other.com",
      isActive: true,
      enabledModules: [...V1_DEFAULT_MODULES],
    });
    const otherOid = otherCompany._id as mongoose.Types.ObjectId;
    const otherWorker = await makeWorker(otherOid);
    await makeVacation(otherWorker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienstWithDriver(
      otherOid,
      otherWorker._id as mongoose.Types.ObjectId,
      "2026-06-12",
    );

    const res = await request(app)
      .get(`${API}/absence-cleanup`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const leaked = (
      res.body.inconsistencies as Array<{ workerId: string }>
    ).find((inc) => inc.workerId === String(otherWorker._id));
    expect(leaked).toBeUndefined();

    await Company.findByIdAndDelete(otherOid);
  });
});

// ── POST /api/operational-recovery/absence-cleanup/repair ────────────────────

describe("POST /api/operational-recovery/absence-cleanup/repair", () => {
  it("returns 400 for empty items array", async () => {
    const res = await request(app)
      .post(`${API}/absence-cleanup/repair`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [] })
      .expect(400);

    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 for invalid ObjectId in items", async () => {
    const res = await request(app)
      .post(`${API}/absence-cleanup/repair`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        items: [
          {
            workerId: "not-an-id",
            absenceType: "vacation",
            absenceId: "507f1f77bcf86cd799439011",
          },
        ],
      })
      .expect(400);

    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 without token", async () => {
    await request(app)
      .post(`${API}/absence-cleanup/repair`)
      .send({
        items: [
          {
            workerId: "507f1f77bcf86cd799439011",
            absenceType: "vacation",
            absenceId: "507f1f77bcf86cd799439012",
          },
        ],
      })
      .expect(401);
  });

  it("returns 403 for worker role", async () => {
    await request(app)
      .post(`${API}/absence-cleanup/repair`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        items: [
          {
            workerId: "507f1f77bcf86cd799439011",
            absenceType: "vacation",
            absenceId: "507f1f77bcf86cd799439012",
          },
        ],
      })
      .expect(403);
  });

  it("returns 200 with repair results for a valid request", async () => {
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await makeWorker(companyOid);
    const vacation = await makeVacation(
      worker._id as mongoose.Types.ObjectId,
      { start: "2026-06-10", end: "2026-06-15" },
    );
    await makeDienstWithDriver(
      companyOid,
      worker._id as mongoose.Types.ObjectId,
      "2026-06-12",
    );

    const res = await request(app)
      .post(`${API}/absence-cleanup/repair`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        items: [
          {
            workerId: String(worker._id),
            absenceType: "vacation",
            absenceId: String(vacation._id),
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("results");
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].repairFailed).toBe(false);
  });
});
