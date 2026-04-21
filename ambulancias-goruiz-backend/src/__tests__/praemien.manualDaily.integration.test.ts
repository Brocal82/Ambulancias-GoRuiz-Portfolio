/**
 * Phase 3: manual daily Prämien entries — worker API + mode gate.
 * Requiere .env.test con MONGODB_URI (o MONGODB_URI_TEST si el proyecto lo usa).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";

const API = "/api";

describe("Praemien - manual-daily (Phase 3)", () => {
  let workerToken: string;
  let adminToken: string;
  let companyId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const { adminToken: aTok, company } = await createTestAdminWithCompany();
    adminToken = aTok;
    companyId = company._id as mongoose.Types.ObjectId;

    const worker = await createTestWorkerInCompany(companyId);
    const workerRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: worker.email, password: "password123" });
    workerToken = workerRes.body.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("PUT /api/praemien/manual-daily rechaza en modo automático (403)", async () => {
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "automatic",
          praemienModeEffectiveFrom: null,
        },
      },
    );

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const res = await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 5 })
      .expect(403);
    expect(res.body.message).toBeDefined();
  });

  it("PUT /api/praemien/manual-daily rechaza si manual aún no vigente (403)", async () => {
    const now = new Date();
    let fy = now.getFullYear();
    let fm = now.getMonth() + 3;
    if (fm > 12) {
      fm -= 12;
      fy += 1;
    }
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: fy, month: fm },
        },
      },
    );

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const res = await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 3 })
      .expect(403);
    expect(res.body.message).toBeDefined();
  });

  it("worker: PUT luego GET month en modo manual vigente (200)", async () => {
    const now = new Date();
    const eff = { year: now.getFullYear(), month: now.getMonth() + 1 };
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: eff,
        },
      },
    );

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const putRes = await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 7, status: "submitted" })
      .expect(200);

    expect(putRes.body).toMatchObject({
      date: dateStr,
      workerSubmittedValue: 7,
      status: "submitted",
    });

    const listRes = await request(app)
      .get(
        `${API}/praemien/manual-daily/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      )
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    const found = listRes.body.find((x: { date: string }) => x.date === dateStr);
    expect(found).toBeDefined();
    expect(found.workerSubmittedValue).toBe(7);
  });

  it("admin no puede usar PUT manual-daily (403 rol)", async () => {
    const now = new Date();
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          },
        },
      },
    );

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: dateStr, workerSubmittedValue: 1 })
      .expect(403);
  });
});
