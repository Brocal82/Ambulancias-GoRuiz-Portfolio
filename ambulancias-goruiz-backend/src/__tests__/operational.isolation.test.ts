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
  dataA: {
    adminToken: string;
    adminId: string;
    companyId: string;
    workerId: string;
    workerToken: string;
    ambulanceId: string;
  };
  dataB: {
    adminToken: string;
    adminId: string;
    companyId: string;
    workerId: string;
    workerToken: string;
    ambulanceId: string;
  };
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

    const [ambA, ambB] = await Promise.all([
      request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${dataA.adminToken}`)
        .send({
          brand: "BrandA",
          modelName: "ModelA",
          licensePlate: "AMB-A-" + Date.now(),
          ambulanceNumber: "AMB-N-A-" + Date.now(),
        }),
      request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${dataB.adminToken}`)
        .send({
          brand: "BrandB",
          modelName: "ModelB",
          licensePlate: "AMB-B-" + Date.now(),
          ambulanceNumber: "AMB-N-B-" + Date.now(),
        }),
    ]);
    const ambulanceIdA = ambA.body._id ?? ambA.body.id;
    const ambulanceIdB = ambB.body._id ?? ambB.body.id;

    fixtures = {
      adminNoCompany: { token: loginLegacy.body.token },
      dataA: {
        adminToken: dataA.adminToken,
        adminId: dataA.adminId,
        companyId: dataA.companyId,
        workerId: String(workerA._id),
        workerToken: workerAToken,
        ambulanceId: ambulanceIdA,
      },
      dataB: {
        adminToken: dataB.adminToken,
        adminId: dataB.adminId,
        companyId: dataB.companyId,
        workerId: String(workerB._id),
        workerToken: workerBToken,
        ambulanceId: ambulanceIdB,
      },
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Diensts - cross-company", () => {
    let dienstIdA: string;
    let dienstIdB: string;
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
              ambulanceId: fixtures.dataA.ambulanceId,
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
              ambulanceId: fixtures.dataB.ambulanceId,
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
              ambulanceId: fixtures.dataB.ambulanceId,
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

    it("no se puede asignar ambulancia de empresa B a dienst de empresa A", async () => {
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          dienstNumber: 199,
          weekStartDate: "2035-09-01",
          weekEndDate: "2035-09-07",
          assignments: [
            {
              date: "2035-09-01",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: fixtures.dataB.ambulanceId,
              driver: fixtures.dataA.workerId,
              medic: fixtures.dataA.workerId,
            },
          ],
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.message).toMatch(/ambulancia|empresa|pertenece/i);
    });

    it("no se puede asignar user de empresa B a dienst de empresa A", async () => {
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          dienstNumber: 198,
          weekStartDate: "2035-09-08",
          weekEndDate: "2035-09-14",
          assignments: [
            {
              date: "2035-09-08",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: fixtures.dataA.ambulanceId,
              driver: fixtures.dataB.workerId,
              medic: fixtures.dataA.workerId,
            },
          ],
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.message).toMatch(/conductor|empresa|pertenece/i);
    });
  });

  describe("Admin sin companyId - no puede crear entidades", () => {
    it("admin sin companyId no puede crear dienst", async () => {
      const res = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-01-01",
          weekEndDate: "2030-01-07",
          assignments: [],
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId no puede crear ambulancia", async () => {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .send({
          brand: "X",
          modelName: "X",
          licensePlate: "X",
          ambulanceNumber: "X",
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId no puede crear hospital", async () => {
      const res = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .send({
          name: "X",
          address: "X",
          phone: "+34 0",
          specialties: [],
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId no puede crear team", async () => {
      const res = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .send({
          driver: fixtures.dataA.adminId,
          medic: fixtures.dataA.workerId,
          rotationMode: "none",
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId no puede usar assign-team-to-week", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .send({
          dienstNumber: 100,
          weekStartDate: "2035-08-11",
          teamId: fixtures.dataA.workerId,
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId no puede usar assign-user-to-week", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-user-to-week`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .send({
          dienstNumber: 100,
          weekStartDate: "2035-08-11",
          userId: fixtures.dataA.workerId,
          role: "medic",
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });
  });

  describe("Teams - cross-company", () => {
    it("no se puede crear team con driver de empresa A y medic de empresa B", async () => {
      const res = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          driver: fixtures.dataA.workerId,
          medic: fixtures.dataB.workerId,
          rotationMode: "none",
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|misma empresa|pertenece/i);
    });

    it("no se puede crear team con driver de empresa B cuando admin es de A", async () => {
      const res = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          driver: fixtures.dataB.workerId,
          medic: fixtures.dataA.workerId,
          rotationMode: "none",
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/empresa|misma empresa|pertenece/i);
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
              ambulanceId: fixtures.dataA.ambulanceId,
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
              ambulanceId: fixtures.dataA.ambulanceId,
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
        ambulanceId: fixtures.dataA.ambulanceId,
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
        ambulanceId: fixtures.dataA.ambulanceId,
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

  describe("Ambulances - cross-company", () => {
    it("admin sin companyId recibe 403 en GET /ambulances", async () => {
      const res = await request(app)
        .get(`${API}/ambulances`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin A no puede ver ambulancia de empresa B (GET /ambulances/:id)", async () => {
      const res = await request(app)
        .get(`${API}/ambulances/${fixtures.dataB.ambulanceId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`);
      expect([403, 404]).toContain(res.status);
    });

    it("admin A no puede editar ambulancia de empresa B (PUT)", async () => {
      const res = await request(app)
        .put(`${API}/ambulances/${fixtures.dataB.ambulanceId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          brand: "Hacked",
          modelName: "X",
          licensePlate: "X",
          ambulanceNumber: "X",
        });
      expect([403, 404]).toContain(res.status);
    });

    it("admin A no puede borrar ambulancia de empresa B (DELETE)", async () => {
      const res = await request(app)
        .delete(`${API}/ambulances/${fixtures.dataB.ambulanceId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`);
      expect([403, 404]).toContain(res.status);
    });

    it("admin A solo lista ambulancias de su empresa (GET /ambulances)", async () => {
      const res = await request(app)
        .get(`${API}/ambulances`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const a of res.body) {
        expect(a.companyId?.toString?.() ?? a.companyId).toBe(fixtures.dataA.companyId);
      }
      const ids = res.body.map((a: any) => a._id?.toString?.() ?? a._id);
      expect(ids).toContain(fixtures.dataA.ambulanceId);
      expect(ids).not.toContain(fixtures.dataB.ambulanceId);
    });

    it("worker A no ve ambulancias de empresa B (GET /ambulances)", async () => {
      const res = await request(app)
        .get(`${API}/ambulances`)
        .set("Authorization", `Bearer ${fixtures.dataA.workerToken}`)
        .expect(200);
      const ids = res.body.map((a: any) => a._id?.toString?.() ?? a._id);
      expect(ids).not.toContain(fixtures.dataB.ambulanceId);
    });
  });

  describe("Hospitals - cross-company", () => {
    let hospitalIdA: string;
    let hospitalIdB: string;

    beforeAll(async () => {
      const createA = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          name: "Hospital A",
          address: "Calle A 1",
          phone: "+34 111",
          specialties: ["Urgencias"],
        });
      expect(createA.status).toBe(201);
      hospitalIdA = createA.body._id ?? createA.body.id;

      const createB = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${fixtures.dataB.adminToken}`)
        .send({
          name: "Hospital B",
          address: "Calle B 1",
          phone: "+34 222",
          specialties: ["Trauma"],
        });
      expect(createB.status).toBe(201);
      hospitalIdB = createB.body._id ?? createB.body.id;
    });

    it("admin sin companyId recibe 403 en GET /hospitals", async () => {
      const res = await request(app)
        .get(`${API}/hospitals`)
        .set("Authorization", `Bearer ${fixtures.adminNoCompany.token}`)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin A no puede editar hospital de empresa B (PUT)", async () => {
      const res = await request(app)
        .put(`${API}/hospitals/${hospitalIdB}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          name: "Hacked",
          address: "X",
          phone: "+34 999",
          specialties: ["X"],
        });
      expect([403, 404]).toContain(res.status);
    });

    it("admin A no puede borrar hospital de empresa B (DELETE)", async () => {
      const res = await request(app)
        .delete(`${API}/hospitals/${hospitalIdB}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`);
      expect([403, 404]).toContain(res.status);
    });

    it("admin A solo lista hospitales de su empresa (GET /hospitals)", async () => {
      const res = await request(app)
        .get(`${API}/hospitals`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const h of res.body) {
        expect(h.companyId?.toString?.() ?? h.companyId).toBe(fixtures.dataA.companyId);
      }
      const ids = res.body.map((h: any) => h._id?.toString?.() ?? h._id);
      expect(ids).toContain(hospitalIdA);
      expect(ids).not.toContain(hospitalIdB);
    });

    it("worker B no ve hospitales de empresa A (GET /hospitals)", async () => {
      const res = await request(app)
        .get(`${API}/hospitals`)
        .set("Authorization", `Bearer ${fixtures.dataB.workerToken}`)
        .expect(200);
      const ids = res.body.map((h: any) => h._id?.toString?.() ?? h._id);
      expect(ids).not.toContain(hospitalIdA);
    });
  });
});
