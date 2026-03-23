/**
 * Tests de aislamiento multiempresa para vacaciones.
 * Admin A no debe ver/aceptar/rechazar/eliminar vacaciones de empresa B.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";
import VacationRequest from "../modules/vacation/models/vacation-request.model";

const API = "/api";

let dataA: { adminToken: string; companyId: string };
let dataB: { adminToken: string; companyId: string };
let workerAId: string;
let workerBId: string;
let vacationAId: string;
let vacationBId: string;

describe("Vacations isolation", () => {
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

    const vacARes = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${loginA.body.token}`)
      .send({
        startDate: "2030-06-01",
        endDate: "2030-06-05",
      })
      .expect(201);
    vacationAId = vacARes.body?._id ?? vacARes.body?.id;

    const vacBRes = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${loginB.body.token}`)
      .send({
        startDate: "2030-07-01",
        endDate: "2030-07-05",
      })
      .expect(201);
    vacationBId = vacBRes.body?._id ?? vacBRes.body?.id;
  });

  afterAll(async () => {
    await VacationRequest.deleteMany({
      user: { $in: [workerAId, workerBId] },
    });
    await mongoose.disconnect();
  });

  it("admin A solo ve vacaciones de su empresa", async () => {
    const res = await request(app)
      .get(`${API}/vacations`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(vacationAId);
  });

  it("admin A no puede aceptar vacación de empresa B", async () => {
    const res = await request(app)
      .patch(`${API}/vacations/${vacationBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ status: "accepted" })
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede rechazar vacación de empresa B", async () => {
    const res = await request(app)
      .patch(`${API}/vacations/${vacationBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ status: "cancelled" })
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede eliminar vacación de empresa B", async () => {
    const res = await request(app)
      .delete(`${API}/vacations/${vacationBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });
});
