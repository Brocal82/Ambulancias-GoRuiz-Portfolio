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
let workerAToken: string;
let workerBToken: string;
let appointmentAId: string;
let appointmentBId: string;
let legacyAppointmentId: string;
let confirmedAId: string;
let cancellationRequestedBId: string;

function futureSlot(daysAhead = 7, durationHours = 1) {
  const start = new Date();
  start.setDate(start.getDate() + daysAhead);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + durationHours);
  return { start: start.toISOString(), end: end.toISOString() };
}

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
    workerAToken = loginA.body.token;
    workerBToken = loginB.body.token;

    const apptARes = await request(app)
      .post(`${API}/appointments/requests`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ reason: "Check A", details: "Detail A" })
      .expect(201);
    appointmentAId = apptARes.body?._id ?? apptARes.body?.id;

    const apptBRes = await request(app)
      .post(`${API}/appointments/requests`)
      .set("Authorization", `Bearer ${workerBToken}`)
      .send({ reason: "Check B", details: "Detail B" })
      .expect(201);
    appointmentBId = apptBRes.body?._id ?? apptBRes.body?.id;

    const legacy = await Appointment.create({
      workerId: new mongoose.Types.ObjectId(workerAId),
      companyId: null,
      reason: "Legacy A",
      details: "Legacy detail",
      status: "pending",
      proposedSlots: [],
      selectedSlot: null,
    });
    legacyAppointmentId = String(legacy._id);

    const slot = futureSlot(14);
    const confirmed = await Appointment.create({
      workerId: new mongoose.Types.ObjectId(workerAId),
      companyId: new mongoose.Types.ObjectId(resA.companyId),
      reason: "Confirmed A",
      details: "Confirmed detail",
      status: "confirmed",
      proposedSlots: [slot],
      selectedSlot: slot,
    });
    confirmedAId = String(confirmed._id);

    const cancelReq = await Appointment.create({
      workerId: new mongoose.Types.ObjectId(workerBId),
      companyId: new mongoose.Types.ObjectId(resB.companyId),
      reason: "Cancel req B",
      details: "Cancel detail",
      status: "cancellation_requested",
      proposedSlots: [],
      selectedSlot: null,
      cancellationMessage: "Need to cancel",
    });
    cancellationRequestedBId = String(cancelReq._id);
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
    const ids = res.body.map((a: { _id: string }) => a._id);
    expect(ids).toContain(appointmentAId);
    expect(ids).toContain(legacyAppointmentId);
    expect(ids).not.toContain(appointmentBId);
  });

  it("admin A solo ve open appointments de su empresa", async () => {
    const res = await request(app)
      .get(`${API}/appointments/open`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((a: { _id: string }) => a._id);
    expect(ids).toContain(appointmentAId);
    expect(ids).toContain(legacyAppointmentId);
    expect(ids).not.toContain(appointmentBId);
    expect(ids).not.toContain(cancellationRequestedBId);
  });

  it("admin A count pending no incluye citas de empresa B", async () => {
    const resA = await request(app)
      .get(`${API}/appointments/count`)
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    const resB = await request(app)
      .get(`${API}/appointments/count`)
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${dataB.adminToken}`)
      .expect(200);
    expect(resA.body.count).toBeGreaterThanOrEqual(2);
    expect(resB.body.count).toBe(1);
  });

  it("admin A calendar solo incluye confirmadas de su empresa", async () => {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date();
    to.setFullYear(to.getFullYear() + 1);

    const res = await request(app)
      .get(`${API}/appointments/calendar`)
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    const ids = res.body.map((a: { _id: string }) => a._id);
    expect(ids).toContain(confirmedAId);
    expect(ids).not.toContain(appointmentBId);
  });

  it("admin A ve cita legacy (companyId null) vía fallback del worker", async () => {
    const res = await request(app)
      .get(`${API}/appointments/open`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    const legacy = res.body.find(
      (a: { _id: string }) => a._id === legacyAppointmentId,
    );
    expect(legacy).toBeDefined();
    expect(legacy.reason).toBe("Legacy A");
  });

  it("admin A no puede proponer slots sobre appointment de empresa B", async () => {
    const { start, end } = futureSlot();

    const res = await request(app)
      .post(`${API}/appointments/${appointmentBId}/propose`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ proposedSlots: [{ start, end }] })
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede PATCH appointment de empresa B", async () => {
    const res = await request(app)
      .patch(`${API}/appointments/${appointmentBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ reason: "Hacked" })
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede accept-cancel sobre appointment de empresa B", async () => {
    const res = await request(app)
      .post(`${API}/appointments/${cancellationRequestedBId}/accept-cancel`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
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
