/**
 * Workday / Trips hardening integration tests.
 * Covers: trip reload from DB, closure lifecycle guards, KM invariants,
 * stale client snapshots, TripSetup tenant filtering.
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
import { Trip } from "../modules/trips/models/trip.model";
import { TripSetup } from "../modules/trips/models/trip-setup.model";

const API = "/api";

async function loginWorker(email: string, password = "password123") {
  const res = await request(app)
    .post(`${API}/users/login`)
    .send({ email, password });
  return res.body.token;
}

describe("Workday hardening - closure lifecycle and trip reload", () => {
  let adminToken: string;
  let workerToken: string;
  let adminId: string;
  let workerId: string;
  let companyId: string;
  let adminBToken: string;
  let ambulanceId: string;
  let assignmentId: string;

  const HARDEN_DATE = "2031-03-15";

  const baseTripPayload = (aid: string, suffix: string) => ({
    date: HARDEN_DATE,
    assignmentId: aid,
    driver: adminId,
    medic: workerId,
    auftragNumber: `H-${suffix}`,
    patientName: "Paciente Hardening",
    fromAddress: "Calle A 1",
    toAddress: "Hospital B",
    timeWarning: "08:00",
    timeAtHome: "08:15",
    timePickup: "08:30",
    timeArrival: "09:00",
    timeEnd: "09:15",
    kmStart: 100,
    kmEnd: 110,
    wasCancelled: false,
    cancelledAtPickup: false,
    countsTrip: 1,
    reports: "",
  });

  const closurePayload = (
    aid: string,
    date: string,
    tripDocs: Array<{ _id: string; kmStart?: number; kmEnd?: number }>,
    overrides: Record<string, unknown> = {},
  ) => ({
    date,
    assignmentId: aid,
    ambulanceId,
    ambulanceNumber: "H-1",
    initialKm: 100,
    finalKm: 120,
    trips: tripDocs.map((t) => {
      const entry: Record<string, unknown> = {
        _id: t._id,
        auftragNumber: "IGNORED",
        patientName: "IGNORED",
        fromAddress: "X",
        toAddress: "Y",
        timeWarning: "08:00",
        wasCancelled: false,
        countsTrip: 1,
      };
      if (t.kmStart !== undefined) entry.kmStart = t.kmStart;
      if (t.kmEnd !== undefined) entry.kmEnd = t.kmEnd;
      return entry;
    }),
    ...overrides,
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

    const dataB = await createTestAdminWithCompany();
    adminBToken = dataB.adminToken;

    const ambRes = await request(app)
      .post(`${API}/ambulances`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        brand: "Harden",
        modelName: "X",
        licensePlate: "HARD-" + Date.now(),
        ambulanceNumber: "HARD-N-" + Date.now(),
      })
      .expect(201);
    ambulanceId = ambRes.body._id ?? ambRes.body.id;

    const dienstRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 300,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date: HARDEN_DATE,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    assignmentId =
      dienstRes.body.assignments?.[0]?._id?.toString() ??
      dienstRes.body.assignments?.[0]?.id?.toString() ??
      "";
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("POST final closure uses DB trip data, not tampered client snapshot", async () => {
    const date = "2031-03-16";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 301,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    const tripRes = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...baseTripPayload(aid, "snap"), date, kmStart: 200, kmEnd: 215 })
      .expect(201);
    const tripId = tripRes.body._id;

    const res = await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(
        closurePayload(aid, date, [{ _id: tripId, kmStart: 1, kmEnd: 2 }], {
          initialKm: 200,
          finalKm: 220,
        }),
      )
      .expect(409);
    expect(String(res.body.message)).toContain("no coinciden");
  });

  it("POST final closure persists server-side km values in summary", async () => {
    const date = "2031-03-17";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 302,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    const tripRes = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...baseTripPayload(aid, "db"), date, kmStart: 300, kmEnd: 318 })
      .expect(201);
    const tripId = tripRes.body._id;

    const res = await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(
        closurePayload(aid, date, [{ _id: tripId }], {
          initialKm: 300,
          finalKm: 330,
        }),
      )
      .expect(201);

    expect(res.body.trips).toHaveLength(1);
    expect(res.body.trips[0].kmStart).toBe(300);
    expect(res.body.trips[0].kmEnd).toBe(318);

    const dbTrip = await Trip.findById(tripId).lean();
    expect(dbTrip?.sentInSummary).toBe(true);
  });

  it("POST final closure rejects duplicate final closure (409)", async () => {
    const date = "2031-03-18";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 303,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(closurePayload(aid, date, [], { initialKm: 0, finalKm: 10 }))
      .expect(201);

    const dup = await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(closurePayload(aid, date, [], { initialKm: 0, finalKm: 15 }))
      .expect(409);
    expect(String(dup.body.message)).toContain("cierre final");
  });

  it("POST partial closure rejected after final closure (409)", async () => {
    const date = "2031-03-19";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 304,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(closurePayload(aid, date, [], { initialKm: 0, finalKm: 10 }))
      .expect(201);

    const partial = await request(app)
      .post(`${API}/workday-summary/partial`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...closurePayload(aid, date, [], { initialKm: 0, finalKm: 12 }),
        partialClosureReason: "Tarde",
      })
      .expect(409);
    expect(String(partial.body.message)).toContain("cierre final");
  });

  it("POST closure rejects finalKm < initialKm (400)", async () => {
    const date = "2031-03-20";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 305,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    const res = await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(closurePayload(aid, date, [], { initialKm: 100, finalKm: 50 }))
      .expect(400);
    expect(res.body).toHaveProperty("message");
  });

  it("POST closure rejects malformed tripIds (400)", async () => {
    const date = "2031-03-21";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 306,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    await request(app)
      .post(`${API}/workday-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...closurePayload(aid, date, []),
        trips: [{ _id: "not-a-valid-id" }],
      })
      .expect(400);
  });

  it("POST closure rejects trips already sentInSummary (400)", async () => {
    const date = "2031-03-22";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 307,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    const tripRes = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...baseTripPayload(aid, "sent"), date })
      .expect(201);
    const tripId = tripRes.body._id;
    await Trip.findByIdAndUpdate(tripId, { $set: { sentInSummary: true } });

    const res = await request(app)
      .post(`${API}/workday-summary/partial`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        ...closurePayload(aid, date, [{ _id: tripId }], {
          initialKm: 100,
          finalKm: 120,
        }),
        partialClosureReason: "Parcial",
      })
      .expect(400);
    expect(String(res.body.message)).toContain("disponibles");
  });

  it("POST /api/trips rejects kmEnd < kmStart (400)", async () => {
    const payload = baseTripPayload(assignmentId, "bad-km");
    payload.kmStart = 500;
    payload.kmEnd = 400;
    payload.auftragNumber = "BAD-KM-" + Date.now();

    const res = await request(app)
      .post(`${API}/trips`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload)
      .expect(400);
    expect(res.body).toHaveProperty("message");
  });

  it("TripSetup GET/PUT scoped by companyId — cross-tenant blocked", async () => {
    const setupRes = await request(app)
      .put(`${API}/trips/setup/${assignmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ambulanceId,
        ambulanceNumber: "SETUP-1",
        initialKm: 1000,
      })
      .expect(200);
    expect(setupRes.body.initialKm).toBe(1000);

    await request(app)
      .get(`${API}/trips/setup/${assignmentId}`)
      .set("Authorization", `Bearer ${adminBToken}`)
      .expect(404);

    const ownRead = await request(app)
      .get(`${API}/trips/setup/${assignmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(ownRead.body?.initialKm).toBe(1000);
    expect(String(ownRead.body?.companyId)).toBe(companyId);
  });

  it("TripSetup upsert writes companyId from assignment tenant", async () => {
    const date = "2031-03-23";
    const dRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: 308,
        weekStartDate: "2031-03-10",
        weekEndDate: "2031-03-16",
        assignments: [
          {
            date,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId,
            driver: adminId,
            medic: workerId,
          },
        ],
      })
      .expect(201);
    const aid =
      dRes.body.assignments?.[0]?._id?.toString() ??
      dRes.body.assignments?.[0]?.id?.toString() ??
      "";

    await request(app)
      .put(`${API}/trips/setup/${aid}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ambulanceId,
        ambulanceNumber: "TS-2",
        initialKm: 555,
      })
      .expect(200);

    const doc = await TripSetup.findOne({
      assignmentId: new mongoose.Types.ObjectId(aid),
      companyId: new mongoose.Types.ObjectId(companyId),
    }).lean();
    expect(doc).not.toBeNull();
    expect(doc?.initialKm).toBe(555);
  });
});
