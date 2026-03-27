/**
 * Tests de integración para Trips - ownership y filtrado (seguridad).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Usa una DB real dedicada para tests (ej: ambulancias_test).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";

const API = "/api";

async function loginWorker(email: string, password = "password123") {
  const res = await request(app)
    .post(`${API}/users/login`)
    .send({ email, password });
  return res.body.token;
}

describe("Trips - ownership y filtrado (seguridad)", () => {
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let adminId: string;
  let assignmentIdParticipant: string;
  let assignmentIdNoParticipant: string;
  let companyId: string;
  let ambulanceId: string;

  const TRIPS_DATE = "2030-07-20";

  const baseTripPayload = (
    assignmentId: string,
    driverVal: string,
    medicVal: string,
  ) => ({
    date: TRIPS_DATE,
    assignmentId,
    driver: driverVal,
    medic: medicVal,
    auftragNumber: "T001",
    patientName: "Paciente Test",
    fromAddress: "Calle A 1",
    toAddress: "Calle B 2",
    timeWarning: "08:00",
    timeAtHome: "08:15",
    timePickup: "08:30",
    timeArrival: "09:00",
    timeEnd: "09:15",
    kmStart: 100,
    kmEnd: 105,
    wasCancelled: false,
    cancelledAtPickup: false,
    countsTrip: 1,
    reports: "",
  });

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    adminId = data.adminId;
    companyId = data.companyId;
    adminToken = data.adminToken;

    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(data.companyId),
      Date.now(),
    );
    workerId = String(worker._id);
    workerToken = await loginWorker(worker.email);

    const ambRes = await request(app)
      .post(`${API}/ambulances`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        brand: "TripTest",
        modelName: "X",
        licensePlate: "TRIP-" + Date.now(),
        ambulanceNumber: "TRIP-N-" + Date.now(),
      })
      .expect(201);
    ambulanceId = ambRes.body._id ?? ambRes.body.id;

    const createRes1 = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 80,
        weekStartDate: "2030-07-16",
        weekEndDate: "2030-07-22",
        assignments: [
          {
            date: TRIPS_DATE,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId: ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      });
    expect(createRes1.status).toBe(201);
    assignmentIdParticipant =
      createRes1.body.assignments?.[0]?._id?.toString() ??
      createRes1.body.assignments?.[0]?.id?.toString() ??
      "";

    const createRes2 = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 81,
        weekStartDate: "2030-07-16",
        weekEndDate: "2030-07-22",
        assignments: [
          {
            date: TRIPS_DATE,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId: ambulanceId,
            driver: adminId,
            medic: adminId,
          },
        ],
      });
    expect(createRes2.status).toBe(201);
    assignmentIdNoParticipant =
      createRes2.body.assignments?.[0]?._id?.toString() ??
      createRes2.body.assignments?.[0]?.id?.toString() ??
      "";

    const tripPayloadAdmin = baseTripPayload(
      assignmentIdParticipant,
      adminId,
      workerId,
    );
    await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(tripPayloadAdmin)
      .expect(201);

    const tripPayloadOther = baseTripPayload(
      assignmentIdNoParticipant,
      adminId,
      adminId,
    );
    await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(tripPayloadOther)
      .expect(201);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("POST /api/trips sin token devuelve 401", async () => {
    await request(app)
      .post(`${API}/trips`)
      .send(baseTripPayload(assignmentIdParticipant, adminId, workerId))
      .expect(401);
  });

  it("POST /api/trips admin con assignment válido devuelve 201", async () => {
    const payload = baseTripPayload(
      assignmentIdParticipant,
      adminId,
      workerId,
    );
    payload.auftragNumber = "T-ADMIN-" + Date.now();
    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.date).toBe(TRIPS_DATE);
    expect(res.body.auftragNumber).toBe(payload.auftragNumber);
  });

  it("POST /api/trips worker participante devuelve 201", async () => {
    const payload = baseTripPayload(
      assignmentIdParticipant,
      adminId,
      workerId,
    );
    payload.auftragNumber = "T-WORKER-" + Date.now();
    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send(payload)
      .expect(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.date).toBe(TRIPS_DATE);
  });

  it("POST /api/trips worker no participante devuelve 403", async () => {
    const payload = baseTripPayload(
      assignmentIdNoParticipant,
      adminId,
      adminId,
    );
    payload.auftragNumber = "T-FORBIDDEN-" + Date.now();
    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send(payload)
      .expect(403);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("No autorizado");
  });

  it("POST /api/trips assignment inexistente devuelve 404", async () => {
    const fakeAssignmentId = new mongoose.Types.ObjectId().toString();
    const payload = baseTripPayload(fakeAssignmentId, adminId, workerId);
    payload.auftragNumber = "T-404-" + Date.now();
    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload)
      .expect(404);
    expect(res.body).toHaveProperty("message");
  });

  it("POST /api/trips driver/medic falsos en body se ignoran; trip usa los del assignment", async () => {
    const fakeDriverId = "507f1f77bcf86cd799439011";
    const fakeMedicId = "507f1f77bcf86cd799439012";
    const payload = baseTripPayload(
      assignmentIdParticipant,
      fakeDriverId,
      fakeMedicId,
    );
    payload.auftragNumber = "T-FAKE-DM-" + Date.now();
    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send(payload)
      .expect(201);
    const driverStr = res.body.driver?.toString?.() ?? res.body.driver;
    const medicStr = res.body.medic?.toString?.() ?? res.body.medic;
    expect(driverStr).toBe(adminId);
    expect(medicStr).toBe(workerId);
  });

  it("GET /api/trips/date/:date sin token devuelve 401", async () => {
    await request(app)
      .get(`${API}/trips/date/${TRIPS_DATE}`)
      .expect(401);
  });

  it("GET /api/trips/date/:date admin ve todos los trips del día", async () => {
    const res = await request(app)
      .get(`${API}/trips/date/${TRIPS_DATE}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const allFromDate = res.body.every(
      (t: { date?: string }) => t.date === TRIPS_DATE,
    );
    expect(allFromDate).toBe(true);
  });

  it("GET /api/trips/date/:date worker ve solo trips donde participa", async () => {
    const adminRes = await request(app)
      .get(`${API}/trips/date/${TRIPS_DATE}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const workerRes = await request(app)
      .get(`${API}/trips/date/${TRIPS_DATE}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);
    expect(Array.isArray(workerRes.body)).toBe(true);
    const workerTrips = workerRes.body.filter(
      (t: { driver?: string; medic?: string }) =>
        (t.driver?.toString?.() ?? t.driver) === workerId ||
        (t.medic?.toString?.() ?? t.medic) === workerId,
    );
    expect(workerTrips.length).toBe(workerRes.body.length);
    expect(workerRes.body.length).toBeLessThan(adminRes.body.length);
  });

  it("POST /api/trips devuelve 409 si ya existe cierre final para assignment y fecha", async () => {
    const closeDate = "2030-10-05";
    const createRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 90,
        weekStartDate: "2030-10-01",
        weekEndDate: "2030-10-07",
        assignments: [
          {
            date: closeDate,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const aid =
      createRes.body.assignments?.[0]?._id?.toString() ??
      createRes.body.assignments?.[0]?.id?.toString() ??
      "";
    expect(aid).not.toBe("");

    await WorkdaySummary.create({
      date: closeDate,
      assignmentId: new mongoose.Types.ObjectId(aid).toString(),
      driver: new mongoose.Types.ObjectId(adminId),
      medic: new mongoose.Types.ObjectId(workerId),
      ambulanceId: new mongoose.Types.ObjectId(ambulanceId),
      ambulanceNumber: "FIN-CL",
      initialKm: 0,
      finalKm: 0,
      totalDienstKm: 0,
      trips: [
        {
          auftragNumber: "FC1",
          patientName: "P",
          fromAddress: "A",
          toAddress: "B",
          timeWarning: "08:00",
          wasCancelled: false,
          cancelledAtPickup: false,
          countsTrip: 1,
          reports: "",
        },
      ],
      isFinalClosure: true,
      totalEffectivePatients: 0,
      totalRealTrips: 0,
      companyId: new mongoose.Types.ObjectId(companyId),
    });

    const payload = baseTripPayload(aid, adminId, workerId);
    payload.date = closeDate;
    payload.auftragNumber = "T-409-FINAL-" + Date.now();

    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload)
      .expect(409);
    expect(res.body).toHaveProperty("message");
    expect(String(res.body.message)).toContain("cierre final");
  });
});
