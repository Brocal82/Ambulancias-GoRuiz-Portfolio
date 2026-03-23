/**
 * Tests de integración para aislamiento multiempresa en diensts, trips y workday-summary.
 * Complementa multi-tenant.isolation.test.ts (users y messages).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminUser,
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";

const API = "/api";

type Fixtures = {
  adminNoCompany: { token: string };
  dataA: { adminToken: string; companyId: string; workerId: string; workerToken: string };
  dataB: { adminToken: string; companyId: string; workerId: string; workerToken: string };
};

let fixtures: Fixtures;

async function loginWorker(email: string, password: string = "password123") {
  const res = await request(app)
    .post(`${API}/users/login`)
    .send({ email, password });
  return res.body.token;
}

describe("Operational isolation - diensts, trips, workday-summary", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const adminNoCompanyUser = await createTestAdminUser(
      `admin-legacy-${Date.now()}@example.com`,
      "password123",
    );
    const loginLegacy = await request(app)
      .post(`${API}/users/login`)
      .send({ email: adminNoCompanyUser.email, password: "password123" });

    const [dataA, dataB] = await Promise.all([
      createTestAdminWithCompany(),
      createTestAdminWithCompany(),
    ]);

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 100,
    );
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataB.companyId),
      Date.now() + 101,
    );

    const [workerAToken, workerBToken] = await Promise.all([
      loginWorker(workerA.email),
      loginWorker(workerB.email),
    ]);

    fixtures = {
      adminNoCompany: { token: loginLegacy.body.token },
      dataA: {
        adminToken: dataA.adminToken,
        companyId: dataA.companyId,
        workerId: String(workerA._id),
        workerToken: workerAToken,
      },
      dataB: {
        adminToken: dataB.adminToken,
        companyId: dataB.companyId,
        workerId: String(workerB._id),
        workerToken: workerBToken,
      },
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Diensts - cross-company", () => {
    let dienstIdA: string;
    let dienstIdB: string;
    const ambulanceId = new mongoose.Types.ObjectId().toString();
    const TRIP_DATE = "2035-08-15";

    beforeAll(async () => {
      const createA = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          dienstNumber: 100,
          weekStartDate: "2035-08-11",
          weekEndDate: "2035-08-17",
          assignments: [
            {
              date: TRIP_DATE,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId,
              driver: fixtures.dataA.workerId,
              medic: fixtures.dataA.workerId,
            },
          ],
        });
      expect(createA.status).toBe(201);
      dienstIdA = createA.body._id ?? createA.body.id;

      const createB = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataB.adminToken}`)
        .send({
          dienstNumber: 101,
          weekStartDate: "2035-08-11",
          weekEndDate: "2035-08-17",
          assignments: [
            {
              date: TRIP_DATE,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId,
              driver: fixtures.dataB.workerId,
              medic: fixtures.dataB.workerId,
            },
          ],
        });
      expect(createB.status).toBe(201);
      dienstIdB = createB.body._id ?? createB.body.id;
    });

    it("admin A no puede ver dienst de empresa B (GET /diensts/:id)", async () => {
      const res = await request(app)
        .get(`${API}/diensts/${dienstIdB}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(403);
      expect(res.body.message).toMatch(/permiso|No autorizado/i);
    });

    it("admin A no puede editar dienst de empresa B (PUT)", async () => {
      const res = await request(app)
        .put(`${API}/diensts/${dienstIdB}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          dienstNumber: 101,
          weekStartDate: "2035-08-11",
          weekEndDate: "2035-08-17",
          assignments: [
            {
              date: TRIP_DATE,
              startTime: "08:00",
              endTime: "18:00",
              ambulanceId,
              driver: fixtures.dataB.workerId,
              medic: fixtures.dataB.workerId,
            },
          ],
        });
      expect([403, 404]).toContain(res.status);
    });

    it("admin A no puede borrar dienst de empresa B (DELETE)", async () => {
      const res = await request(app)
        .delete(`${API}/diensts/${dienstIdB}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`);
      expect([403, 404]).toContain(res.status);
    });

    it("admin A solo ve diensts de su empresa (GET /diensts)", async () => {
      const res = await request(app)
        .get(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const d of res.body) {
        expect(d.companyId?.toString?.() ?? d.companyId).toBe(fixtures.dataA.companyId);
      }
      const ids = res.body.map((s: any) => s._id?.toString?.() ?? s._id);
      expect(ids).toContain(dienstIdA);
      expect(ids).not.toContain(dienstIdB);
    });

    it("admin sin companyId no puede ver dienst con companyId de empresa B", async () => {
      const res = await request(app)
        .get(`${API}/diensts/${dienstIdB}`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .expect(403);
      expect(res.body.message).toMatch(/permiso|No autorizado/i);
    });

    it("worker A no puede ver dienst de empresa B (GET /diensts/:id)", async () => {
      const res = await request(app)
        .get(`${API}/diensts/${dienstIdB}`)
        .set("Authorization", `Bearer ${fixtures.dataA.workerToken}`)
        .expect(403);
      expect(res.body.message).toMatch(/permiso|No autorizado/i);
    });

    it("worker A solo ve assigned-days de su empresa", async () => {
      const res = await request(app)
        .get(`${API}/diensts/assigned-days/${fixtures.dataA.workerId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.workerToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const a of res.body) {
        expect(a.dienstId).toBeDefined();
      }
    });
  });

  describe("Users available - filtrado por empresa", () => {
    it("admin A solo ve usuarios disponibles de su empresa (GET /users/available)", async () => {
      const res = await request(app)
        .get(`${API}/users/available?date=2035-09-10`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const u of res.body) {
        expect(u.companyId?.toString?.() ?? u.companyId).toBe(fixtures.dataA.companyId);
      }
    });
  });

  describe("Trips - cross-company", () => {
    const TRIP_DATE = "2035-08-15";
    let assignmentIdA: string;
    const ambulanceId = new mongoose.Types.ObjectId().toString();

    beforeAll(async () => {
      const createA = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          dienstNumber: 110,
          weekStartDate: "2035-08-11",
          weekEndDate: "2035-08-17",
          assignments: [
            {
              date: TRIP_DATE,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId,
              driver: fixtures.dataA.workerId,
              medic: fixtures.dataA.workerId,
            },
          ],
        });
      expect(createA.status).toBe(201);
      assignmentIdA =
        createA.body.assignments?.[0]?._id?.toString() ??
        createA.body.assignments?.[0]?.id ??
        "";

      const tripPayload = {
        date: TRIP_DATE,
        assignmentId: assignmentIdA,
        driver: fixtures.dataA.workerId,
        medic: fixtures.dataA.workerId,
        auftragNumber: "OP-T1",
        patientName: "Paciente",
        fromAddress: "A",
        toAddress: "B",
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
      };

      await request(app)
        .post(`${API}/trips`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send(tripPayload)
        .expect(201);
    });

    it("admin B no ve trips de empresa A (GET /trips/date/:date)", async () => {
      const res = await request(app)
        .get(`${API}/trips/date/${TRIP_DATE}`)
        .set("Authorization", `Bearer ${fixtures.dataB.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const tripFromA = res.body.find(
        (t: any) =>
          t.assignmentId?.toString?.() === assignmentIdA ||
          String(t.assignmentId) === assignmentIdA,
      );
      expect(tripFromA).toBeUndefined();
    });

    it("admin B no puede crear trip en assignment de empresa A", async () => {
      const tripPayload = {
        date: TRIP_DATE,
        assignmentId: assignmentIdA,
        driver: fixtures.dataA.workerId,
        medic: fixtures.dataA.workerId,
        auftragNumber: "OP-T2-HACK",
        patientName: "Paciente",
        fromAddress: "A",
        toAddress: "B",
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
      };
      const res = await request(app)
        .post(`${API}/trips`)
        .set("Authorization", `Bearer ${fixtures.dataB.adminToken}`)
        .send(tripPayload);
      expect([400, 403]).toContain(res.status);
    });
  });

  describe("Workday-summary - cross-company", () => {
    const WS_DATE = "2035-09-20";
    let assignmentIdA: string;
    let summaryIdA: string;
    const ambulanceId = new mongoose.Types.ObjectId().toString();

    beforeAll(async () => {
      const createA = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          dienstNumber: 120,
          weekStartDate: "2035-09-15",
          weekEndDate: "2035-09-21",
          assignments: [
            {
              date: WS_DATE,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId,
              driver: fixtures.dataA.workerId,
              medic: fixtures.dataA.workerId,
            },
          ],
        });
      expect(createA.status).toBe(201);
      assignmentIdA =
        createA.body.assignments?.[0]?._id?.toString() ??
        createA.body.assignments?.[0]?.id ??
        "";

      const summaryPayload = {
        date: WS_DATE,
        assignmentId: assignmentIdA,
        ambulanceId,
        ambulanceNumber: "1",
        initialKm: 0,
        finalKm: 10,
        trips: [
          {
            auftragNumber: "WS-1",
            patientName: "P",
            fromAddress: "A",
            toAddress: "B",
            timeWarning: "08:00",
            wasCancelled: false,
            countsTrip: 1,
          },
        ],
        extraNote: "Test",
      };

      const createRes = await request(app)
        .post(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send(summaryPayload)
        .expect(201);
      summaryIdA = createRes.body._id ?? createRes.body.id;
    });

    it("admin B no ve workday-summary de empresa A (GET /workday-summary)", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${fixtures.dataB.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find(
        (s: any) =>
          (s._id?.toString?.() ?? s._id) === summaryIdA ||
          s.assignmentId?.toString?.() === assignmentIdA,
      );
      expect(found).toBeUndefined();
    });

    it("admin B no puede cerrar assignment de empresa A (POST /workday-summary)", async () => {
      const payload = {
        date: "2035-09-21",
        assignmentId: assignmentIdA,
        ambulanceId,
        ambulanceNumber: "1",
        initialKm: 0,
        finalKm: 10,
        trips: [
          {
            auftragNumber: "WS-2",
            patientName: "P",
            fromAddress: "A",
            toAddress: "B",
            timeWarning: "08:00",
            wasCancelled: false,
            countsTrip: 1,
          },
        ],
        extraNote: "Test",
      };
      const res = await request(app)
        .post(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${fixtures.dataB.adminToken}`)
        .send(payload);
      expect([403]).toContain(res.status);
    });

    it("worker B no ve workday-summary de empresa A (GET /workday-summary)", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${fixtures.dataB.workerToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find(
        (s: any) => s.assignmentId?.toString?.() === assignmentIdA,
      );
      expect(found).toBeUndefined();
    });
  });
});
