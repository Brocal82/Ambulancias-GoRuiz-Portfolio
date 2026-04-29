import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestSuperadmin } from "./test-helpers";

const API = "/api";

describe("Superadmin security monitoring operational health", () => {
  let superadminToken = "";

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const sa = await createTestSuperadmin();
    superadminToken = sa.superadminToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns operational monitoring health payload", async () => {
    const res = await request(app)
      .get(`${API}/support-access/monitoring/health`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .expect(200);

    expect(["ok", "down"]).toContain(res.body.dbStatus);
    expect(typeof res.body.monitoringEnabled).toBe("boolean");
    expect(typeof res.body.monitoringCron).toBe("string");
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });
});
