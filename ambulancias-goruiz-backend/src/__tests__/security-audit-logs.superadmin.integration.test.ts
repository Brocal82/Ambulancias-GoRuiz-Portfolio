import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { emitAuditLog } from "../security/audit-log";
import { AUDIT_EVENT } from "../security/audit-events";
import { createTestSuperadmin } from "./test-helpers";

const API = "/api";

describe("Superadmin security audit log query", () => {
  let superadminToken = "";

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const sa = await createTestSuperadmin();
    superadminToken = sa.superadminToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns filtered persisted audit logs", async () => {
    const marker = `tenant-${Date.now()}`;
    emitAuditLog(AUDIT_EVENT.FILE_ACCESS_DENIED, "denied", {
      actorUserId: "audit-user",
      tenantCompanyId: marker,
      resourceType: "file",
      resourceId: "f-1",
      statusCode: 403,
      reason: "integration-filter-test",
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await request(app)
      .get(`${API}/support-access/monitoring/audit-logs`)
      .query({ hours: 24, outcome: "denied", tenantCompanyId: marker, limit: 20 })
      .set("Authorization", `Bearer ${superadminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(
      res.body.rows.some(
        (row: any) =>
          row?.tenantCompanyId === marker &&
          row?.outcome === "denied" &&
          row?.event === AUDIT_EVENT.FILE_ACCESS_DENIED,
      ),
    ).toBe(true);
  });
});
