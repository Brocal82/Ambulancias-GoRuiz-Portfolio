import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import SupportAccessRequest from "../modules/support-access/models/support-access-request.model";
import { createTestSuperadmin } from "./test-helpers";

const API = "/api";

describe("Superadmin tenant risk ranking", () => {
  let superadminToken = "";

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const sa = await createTestSuperadmin();
    superadminToken = sa.superadminToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns tenant risk rows ranked by computed score", async () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const now = new Date();

    await SupportAccessRequest.create([
      {
        companyId: tenantA,
        requestedBy: user,
        reason: "a1",
        ticketId: `RA-${Date.now()}-1`,
        durationMinutes: 30,
        status: "denied",
        approvalsCount: 0,
        approvalsRequired: 2,
        createdAt: now,
        reviewedAt: now,
        updatedAt: now,
      },
      {
        companyId: tenantA,
        requestedBy: user,
        reason: "a2",
        ticketId: `RA-${Date.now()}-2`,
        durationMinutes: 30,
        status: "approved",
        approvalsCount: 2,
        approvalsRequired: 2,
        createdAt: now,
        reviewedAt: new Date(now.setHours(22, 0, 0, 0)),
        updatedAt: now,
      },
      {
        companyId: tenantB,
        requestedBy: user,
        reason: "b1",
        ticketId: `RB-${Date.now()}-1`,
        durationMinutes: 30,
        status: "approved",
        approvalsCount: 2,
        approvalsRequired: 2,
        createdAt: new Date(),
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app)
      .get(`${API}/support-access/monitoring/tenant-risk`)
      .query({ hours: 24, limit: 10 })
      .set("Authorization", `Bearer ${superadminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body.rows[0]).toHaveProperty("tenantCompanyId");
    expect(res.body.rows[0]).toHaveProperty("riskScore");
    expect(res.body.rows[0]).toHaveProperty("riskLevel");
  });
});
