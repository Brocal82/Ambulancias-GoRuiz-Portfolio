/**
 * Tests de aislamiento multiempresa para appointments.
 * Admin A no debe ver/modificar/cancelar citas de empresa B.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";
import { Appointment } from "../modules/appointments/models/appointment.model";

const API = "/api";

let dataA: { adminToken: string; companyId: string };
let dataB: { adminToken: string; companyId: string };
let workerAId: string;
let workerBId: string;
let appointmentAId: string;
let appointmentBId: string;

describe("Appointments isolation", () => {
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

    const apptARes = await request(app)
      .post(`${API}/appointments/requests`)
      .set("Authorization", `Bearer ${loginA.body.token}`)
      .send({ reason: "Check A", details: "Detail A" })
      .expect(201);
    appointmentAId = apptARes.body?._id ?? apptARes.body?.id;

    const apptBRes = await request(app)
      .post(`${API}/appointments/requests`)
      .set("Authorization", `Bearer ${loginB.body.token}`)
      .send({ reason: "Check B", details: "Detail B" })
      .expect(201);
    appointmentBId = apptBRes.body?._id ?? apptBRes.body?.id;
  });

  afterAll(async () => {
    await Appointment.deleteMany({
      workerId: { $in: [workerAId, workerBId] },
    });
    await mongoose.disconnect();
  });

  it("admin A solo ve appointments pendientes de su empresa", async () => {
    const res = await request(app)
      .get(`${API}/appointments/pending`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(appointmentAId);
  });

  it("admin A no puede proponer slots sobre appointment de empresa B", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const start = future.toISOString();
    future.setHours(future.getHours() + 1);
    const end = future.toISOString();

    const res = await request(app)
      .post(`${API}/appointments/${appointmentBId}/propose`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ proposedSlots: [{ start, end }] })
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede cancelar appointment de empresa B", async () => {
    const res = await request(app)
      .delete(`${API}/appointments/${appointmentBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });
});
