/**
 * Tests de integración para Praemien - monthly-summary / monthly-history (IDOR fix).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Usa una DB real dedicada para tests (ej: ambulancias_test).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestUsers } from "./test-helpers";

const API = "/api";

describe("Praemien - monthly-summary / monthly-history (IDOR fix)", () => {
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let adminId: string;

  const ambulanceId = new mongoose.Types.ObjectId();
  const minimalTrip = {
    auftragNumber: "T1",
    patientName: "P1",
    fromAddress: "A",
    toAddress: "B",
    timeWarning: "08:00",
    wasCancelled: false,
    countsTrip: 1 as const,
  };

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const { adminId: aid, workerId: wid, adminToken: aTok, workerToken: wTok } =
      await createTestUsers();
    adminId = aid;
    workerId = wid;
    adminToken = aTok;
    workerToken = wTok;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const dateStr = `${year}-${month}-01`;

    const WorkdaySummary = mongoose.model("WorkdaySummary");
    await WorkdaySummary.create({
      date: dateStr,
      assignmentId: `assign-praemien-${Date.now()}`,
      driver: adminId,
      medic: adminId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 10,
      trips: [minimalTrip],
      totalEffectivePatients: 10,
      totalRealTrips: 1,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("GET /api/praemien/monthly-summary sin token devuelve 401", async () => {
    await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .expect(401);
  });

  it("worker sin userId recibe sus propios datos (o vacío)", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty("monthlyData");
    expect(res.body).toHaveProperty("averagePatients");
    expect(Array.isArray(res.body.monthlyData)).toBe(true);
  });

  it("worker con ?userId=adminId ignora el query y recibe sus propios datos (IDOR fix)", async () => {
    const resWorker = await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const resWorkerWithAdminId = await request(app)
      .get(`${API}/praemien/monthly-summary?userId=${adminId}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    expect(resWorkerWithAdminId.body).toEqual(resWorker.body);
  });

  it("admin con ?userId=workerId recibe datos del worker", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary?userId=${workerId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty("monthlyData");
    expect(res.body).toHaveProperty("averagePatients");
  });

  it("admin sin userId recibe sus propios datos", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty("monthlyData");
    expect(res.body.monthlyData.length).toBeGreaterThan(0);
    expect(res.body.averagePatients).toBe(10);
  });

  it("admin con ?userId inválido devuelve 400", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary?userId=id-invalido`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("userId inválido");
  });

  it("GET /api/praemien/monthly-history worker con ?userId=adminId ignora query (IDOR fix)", async () => {
    const resWorker = await request(app)
      .get(`${API}/praemien/monthly-history`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const resWorkerWithAdminId = await request(app)
      .get(`${API}/praemien/monthly-history?userId=${adminId}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    expect(resWorkerWithAdminId.body).toEqual(resWorker.body);
  });
});
