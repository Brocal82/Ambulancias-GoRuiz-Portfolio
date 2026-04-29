import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestSuperadmin } from "./test-helpers";

const API = "/api";

describe("Superadmin security monthly review snapshot", () => {
  let superadminToken = "";

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const sa = await createTestSuperadmin();
    superadminToken = sa.superadminToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns review metrics/checks and overall status", async () => {
    const res = await request(app)
      .get(`${API}/support-access/monitoring/monthly-review`)
      .query({ hours: 720 })
      .set("Authorization", `Bearer ${superadminToken}`)
      .expect(200);

    expect(typeof res.body.generatedAt).toBe("string");
    expect(typeof res.body.windowHours).toBe("number");
    expect(res.body.metrics).toBeTruthy();
    expect(res.body.checks).toBeTruthy();
    expect(["green", "yellow", "red"]).toContain(res.body.overallStatus);
  });
});
