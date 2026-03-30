/**
 * Matriz de roles en sick-leaves: workers no deben usar rutas solo-admin (sin duplicar aislamiento multiempresa).
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
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";

const API = "/api";

describe("Sick-leaves role access (integration)", () => {
  let adminToken: string;
  let workerToken: string;
  let adminId: string;
  let companyId: string;
  let workerId: string;
  let sickLeaveId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    adminToken = data.adminToken;
    adminId = data.adminId;
    companyId = data.companyId;

    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(data.companyId),
      Date.now(),
    );
    workerId = String(worker._id);

    const login = await request(app)
      .post(`${API}/users/login`)
      .send({ email: worker.email, password: "password123" });
    expect(login.status).toBe(200);
    workerToken = login.body.token as string;

    const sickRes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ startDate: "2031-01-05", endDate: "2031-01-07" });
    expect(sickRes.status).toBe(201);
    sickLeaveId = sickRes.body._id ?? sickRes.body.id;
  });

  afterAll(async () => {
    await SickLeave.deleteMany({ user: workerId });
    await User.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(workerId),
          new mongoose.Types.ObjectId(adminId),
        ],
      },
    });
    await Company.deleteOne({ _id: companyId });
    await mongoose.disconnect();
  });

  it("worker gets 403 on GET /api/sick-leaves", async () => {
    const res = await request(app)
      .get(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  it("worker gets 200 on GET /api/sick-leaves/mine", async () => {
    const res = await request(app)
      .get(`${API}/sick-leaves/mine`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("worker gets 403 on POST /api/sick-leaves/:id/accept", async () => {
    const res = await request(app)
      .post(`${API}/sick-leaves/${sickLeaveId}/accept`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  it("worker gets 403 on POST /api/sick-leaves/check-range", async () => {
    const res = await request(app)
      .post(`${API}/sick-leaves/check-range`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        userIds: [workerId],
        fromISO: "2031-01-01",
        toISO: "2031-01-31",
      });
    expect(res.status).toBe(403);
  });

  it("admin gets 200 on GET /api/sick-leaves", async () => {
    const res = await request(app)
      .get(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
