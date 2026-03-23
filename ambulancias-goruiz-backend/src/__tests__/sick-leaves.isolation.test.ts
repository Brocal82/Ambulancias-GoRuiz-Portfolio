/**
 * Tests de aislamiento multiempresa para sick-leaves.
 * Admin A no debe ver/aceptar/rechazar bajas de empresa B.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";

const API = "/api";

let dataA: { adminToken: string; companyId: string };
let dataB: { adminToken: string; companyId: string };
let workerAId: string;
let workerBId: string;
let sickLeaveAId: string;
let sickLeaveBId: string;

describe("Sick-leaves isolation", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const [resA, resB] = await Promise.all([
      createTestAdminWithCompany(),
      createTestAdminWithCompany(),
    ]);

    const [workerA, workerB] = await Promise.all([
      createTestWorkerInCompany(
        new mongoose.Types.ObjectId(resA.companyId),
        Date.now() + 1,
      ),
      createTestWorkerInCompany(
        new mongoose.Types.ObjectId(resB.companyId),
        Date.now() + 2,
      ),
    ]);

    dataA = resA;
    dataB = resB;
    workerAId = String(workerA._id);
    workerBId = String(workerB._id);

    const loginA = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerA.email, password: "password123" });
    const loginB = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerB.email, password: "password123" });

    const sickARes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${loginA.body.token}`)
      .send({ startDate: "2030-06-01", endDate: "2030-06-03" })
      .expect(201);
    sickLeaveAId = sickARes.body?._id ?? sickARes.body?.id;

    const sickBRes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${loginB.body.token}`)
      .send({ startDate: "2030-07-01", endDate: "2030-07-03" })
      .expect(201);
    sickLeaveBId = sickBRes.body?._id ?? sickBRes.body?.id;
  });

  afterAll(async () => {
    await SickLeave.deleteMany({ user: { $in: [workerAId, workerBId] } });
    await mongoose.disconnect();
  });

  it("admin A solo ve sick-leaves de su empresa", async () => {
    const res = await request(app)
      .get(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(sickLeaveAId);
  });

  it("admin A no puede aceptar sick-leave de empresa B", async () => {
    const res = await request(app)
      .post(`${API}/sick-leaves/${sickLeaveBId}/accept`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede rechazar sick-leave de empresa B", async () => {
    const res = await request(app)
      .post(`${API}/sick-leaves/${sickLeaveBId}/reject`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });
});
