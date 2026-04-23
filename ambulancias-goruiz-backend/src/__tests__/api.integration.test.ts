/**
 * Tests de integración para rutas críticas.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Usa una DB real dedicada para tests (ej: ambulancias_test).
 */
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  createTestSuperadmin,
} from "./test-helpers";
import Company from "../modules/companies/models/company.model";
import {
  MODULE_KEYS,
  V1_DEFAULT_MODULES,
} from "../modules/companies/constants/modules.constants";

const API = "/api";

async function loginWorker(email: string, password = "password123") {
  const res = await request(app)
    .post(`${API}/users/login`)
    .send({ email, password });
  return res.body.token;
}

describe("API - Rutas críticas", () => {
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let adminId: string;
  let companyId: string;
  let teamId: string;
  let sharedAmbulanceId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    adminId = data.adminId;
    adminToken = data.adminToken;
    companyId = data.companyId;

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
        brand: "Integration",
        modelName: "X",
        licensePlate: "INT-" + Date.now(),
        ambulanceNumber: "INT-N-" + Date.now(),
      })
      .expect(201);
    sharedAmbulanceId = ambRes.body._id ?? ambRes.body.id;

    const teamRes = await request(app)
      .post(`${API}/teams`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        driver: adminId,
        medic: workerId,
        rotationMode: "none",
      });
    teamId = teamRes.body?._id ?? teamRes.body?.id ?? "";
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("404 - Ruta inexistente", () => {
    it("devuelve 404 con { message } para ruta no encontrada", async () => {
      const res = await request(app)
        .get(`${API}/ruta-inexistente-xyz`)
        .expect(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("Ruta no encontrada");
    });
  });

  describe("Rate limiting - Login", () => {
    it("devuelve 429 tras superar el límite de intentos de login", async () => {
      const max = Number(process.env.RATE_LIMIT_LOGIN_MAX) || 5;
      // beforeAll ya usó 2 logins; necesitamos max-2 más para llenar el límite, luego 1 para 429
      const remaining = Math.max(0, max - 2);
      for (let i = 0; i < remaining; i++) {
        await request(app)
          .post(`${API}/users/login`)
          .send({ email: "noexiste@test.com", password: "wrong" });
      }
      const res = await request(app)
        .post(`${API}/users/login`)
        .send({ email: "noexiste@test.com", password: "wrong" })
        .expect(429);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Demasiados intentos");
    });
  });

  describe("Auth - report-issue", () => {
    it("POST /api/mechanics/report-issue sin token devuelve 401", async () => {
      const res = await request(app)
        .post(`${API}/mechanics/report-issue`)
        .send({ summary: "test", description: "test" })
        .expect(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("Auth - issues (solo admin)", () => {
    it("GET /api/mechanics/issues sin token devuelve 401", async () => {
      const res = await request(app)
        .get(`${API}/mechanics/issues`)
        .expect(401);
      expect(res.body).toHaveProperty("message");
    });

    it("GET /api/mechanics/issues con token worker devuelve 403", async () => {
      const res = await request(app)
        .get(`${API}/mechanics/issues`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("Workday Summary - GET (ownership / filtrado)", () => {
    const SUMMARY_DATE = "2030-09-10";
    const minimalTrip = {
      auftragNumber: "WS-T1",
      patientName: "Paciente",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1 as const,
    };
    let summaryIdWorkerParticipates: string;
    let summaryIdWorkerNotParticipates: string;

    beforeAll(async () => {
      const ambulanceId = new mongoose.Types.ObjectId();
      const WorkdaySummary = mongoose.model("WorkdaySummary");

      const s1 = await WorkdaySummary.create({
        date: SUMMARY_DATE,
        assignmentId: `assign-ws-owner-${Date.now()}`,
        driver: adminId,
        medic: workerId,
        ambulanceId,
        ambulanceNumber: "1",
        initialKm: 0,
        totalDienstKm: 10,
        trips: [minimalTrip],
        totalEffectivePatients: 1,
        totalRealTrips: 1,
        companyId: companyId ? new mongoose.Types.ObjectId(companyId) : undefined,
      });
      summaryIdWorkerParticipates = s1._id.toString();

      const s2 = await WorkdaySummary.create({
        date: SUMMARY_DATE,
        assignmentId: `assign-ws-other-${Date.now()}`,
        driver: adminId,
        medic: adminId,
        ambulanceId,
        ambulanceNumber: "2",
        initialKm: 0,
        totalDienstKm: 5,
        trips: [minimalTrip],
        totalEffectivePatients: 1,
        totalRealTrips: 1,
        companyId: companyId ? new mongoose.Types.ObjectId(companyId) : undefined,
      });
      summaryIdWorkerNotParticipates = s2._id.toString();
    });

    it("GET /api/workday-summary sin token devuelve 401", async () => {
      await request(app)
        .get(`${API}/workday-summary`)
        .expect(401);
    });

    it("GET /api/workday-summary admin devuelve 200 y array", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((s: { _id?: string }) => s._id?.toString?.() ?? s._id);
      expect(ids).toContain(summaryIdWorkerParticipates);
      expect(ids).toContain(summaryIdWorkerNotParticipates);
    });

    it("GET /api/workday-summary worker devuelve 200 y solo summaries donde participa", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((s: { _id?: string }) => s._id?.toString?.() ?? s._id);
      expect(ids).toContain(summaryIdWorkerParticipates);
    });

    it("GET /api/workday-summary worker no recibe summary ajeno", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);
      const ids = res.body.map((s: { _id?: string }) => s._id?.toString?.() ?? s._id);
      expect(ids).not.toContain(summaryIdWorkerNotParticipates);
    });
  });

  describe("Workday Summary - admin mutations (company vs legacy document)", () => {
    const minimalTrip = {
      auftragNumber: "WS-MUT-1",
      patientName: "Paciente",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1 as const,
    };
    let legacyIssueSeenId: string;
    let legacyIssueDeleteId: string;
    let legacySummaryReviewId: string;
    let scopedIssueSeenId: string;
    let scopedIssueDeleteId: string;
    let scopedSummaryReviewId: string;

    beforeAll(async () => {
      const MechanicsIssue = mongoose.model("MechanicsIssue");
      const WorkdaySummary = mongoose.model("WorkdaySummary");
      const companyOid = new mongoose.Types.ObjectId(companyId);
      const ambOid = new mongoose.Types.ObjectId();

      const [li1, li2] = await Promise.all([
        MechanicsIssue.create({
          dienstNumber: 1,
          date: "2030-03-01",
          ambulanceNumber: "L1",
          timestamp: new Date().toISOString(),
          issueText: "legacy for seen",
        }),
        MechanicsIssue.create({
          dienstNumber: 1,
          date: "2030-03-02",
          ambulanceNumber: "L2",
          timestamp: new Date().toISOString(),
          issueText: "legacy for delete",
        }),
      ]);
      legacyIssueSeenId = li1._id.toString();
      legacyIssueDeleteId = li2._id.toString();

      const legacySummary = await WorkdaySummary.create({
        date: "2030-03-03",
        assignmentId: `legacy-assign-mut-${Date.now()}`,
        driver: new mongoose.Types.ObjectId(adminId),
        medic: new mongoose.Types.ObjectId(workerId),
        ambulanceId: ambOid,
        ambulanceNumber: "1",
        initialKm: 0,
        totalDienstKm: 1,
        trips: [minimalTrip],
        totalEffectivePatients: 1,
        totalRealTrips: 1,
        isFinalClosure: true,
      });
      legacySummaryReviewId = legacySummary._id.toString();

      const [si1, si2] = await Promise.all([
        MechanicsIssue.create({
          dienstNumber: 2,
          date: "2030-03-04",
          ambulanceNumber: "S1",
          timestamp: new Date().toISOString(),
          issueText: "scoped for seen",
          companyId: companyOid,
        }),
        MechanicsIssue.create({
          dienstNumber: 2,
          date: "2030-03-05",
          ambulanceNumber: "S2",
          timestamp: new Date().toISOString(),
          issueText: "scoped for delete",
          companyId: companyOid,
        }),
      ]);
      scopedIssueSeenId = si1._id.toString();
      scopedIssueDeleteId = si2._id.toString();

      const scopedSummary = await WorkdaySummary.create({
        date: "2030-03-06",
        assignmentId: `scoped-assign-mut-${Date.now()}`,
        driver: new mongoose.Types.ObjectId(adminId),
        medic: new mongoose.Types.ObjectId(workerId),
        ambulanceId: ambOid,
        ambulanceNumber: "2",
        initialKm: 0,
        totalDienstKm: 1,
        trips: [minimalTrip],
        totalEffectivePatients: 1,
        totalRealTrips: 1,
        isFinalClosure: true,
        companyId: companyOid,
      });
      scopedSummaryReviewId = scopedSummary._id.toString();
    });

    it("admin con empresa no puede marcar vista avería legacy sin companyId (403)", async () => {
      await request(app)
        .patch(`${API}/mechanics/issues/${legacyIssueSeenId}/seen`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    });

    it("admin con empresa no puede borrar avería legacy sin companyId (403)", async () => {
      await request(app)
        .delete(`${API}/mechanics/issues/${legacyIssueDeleteId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    });

    it("admin con empresa no puede revisar resumen legacy sin companyId (403)", async () => {
      await request(app)
        .patch(`${API}/workday-summary/${legacySummaryReviewId}/review`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    });

    it("admin con empresa puede marcar vista avería de su empresa (200)", async () => {
      await request(app)
        .patch(`${API}/mechanics/issues/${scopedIssueSeenId}/seen`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });

    it("admin con empresa puede borrar avería de su empresa (200)", async () => {
      await request(app)
        .delete(`${API}/mechanics/issues/${scopedIssueDeleteId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });

    it("admin con empresa puede revisar resumen de su empresa (200)", async () => {
      await request(app)
        .patch(`${API}/workday-summary/${scopedSummaryReviewId}/review`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe("Workday Summary - legacy admin blocked at controller (requireCompanyForAdmin)", () => {
    /** JWT sin companyId: login real ya no permite admin sin empresa; el token simula el caso legacy en el payload. */
    let jwtAdminWithoutCompany: string;

    beforeAll(() => {
      jwtAdminWithoutCompany = jwt.sign(
        { userId: adminId, role: "admin" },
        env.JWT_SECRET,
        { expiresIn: "1h" },
      );
    });

    const dummyId = () => new mongoose.Types.ObjectId().toString();

    it("admin sin companyId recibe 403 en PATCH .../issues/:id/seen", async () => {
      const res = await request(app)
        .patch(`${API}/mechanics/issues/${dummyId()}/seen`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en DELETE .../issues/:id", async () => {
      const res = await request(app)
        .delete(`${API}/mechanics/issues/${dummyId()}`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en PATCH .../:id/review", async () => {
      const res = await request(app)
        .patch(`${API}/workday-summary/${dummyId()}/review`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });
  });

  describe("Dienst lifecycle - admin mutations require company (controller)", () => {
    let jwtAdminWithoutCompany: string;
    let lifecycleDienstId: string;

    beforeAll(async () => {
      jwtAdminWithoutCompany = jwt.sign(
        { userId: adminId, role: "admin" },
        env.JWT_SECRET,
        { expiresIn: "1h" },
      );
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 77,
          weekStartDate: "2031-01-05",
          weekEndDate: "2031-01-11",
          assignments: [
            {
              date: "2031-01-06",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
      lifecycleDienstId = createRes.body._id ?? createRes.body.id;
    });

    it("admin sin companyId recibe 403 en POST /diensts", async () => {
      const res = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .send({
          dienstNumber: 79,
          weekStartDate: "2031-04-06",
          weekEndDate: "2031-04-12",
          assignments: [
            {
              date: "2031-04-07",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en PUT /diensts/:id", async () => {
      const res = await request(app)
        .put(`${API}/diensts/${lifecycleDienstId}`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .send({ dienstNumber: 77 })
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en DELETE /diensts/:id", async () => {
      const res = await request(app)
        .delete(`${API}/diensts/${lifecycleDienstId}`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en POST /diensts/delete-week", async () => {
      const res = await request(app)
        .post(`${API}/diensts/delete-week`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .send({ weekStartDate: "2031-01-05" })
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin con empresa puede PUT y DELETE dienst de su empresa", async () => {
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 78,
          weekStartDate: "2031-02-02",
          weekEndDate: "2031-02-08",
          assignments: [
            {
              date: "2031-02-03",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
      const id = createRes.body._id ?? createRes.body.id;
      await request(app)
        .put(`${API}/diensts/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ dienstNumber: 78 })
        .expect(200);
      await request(app)
        .delete(`${API}/diensts/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });

    it("admin con empresa puede POST /diensts/delete-week", async () => {
      await request(app)
        .post(`${API}/diensts/delete-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ weekStartDate: "2031-03-02" })
        .expect(200);
    });
  });

  describe("Dienst assignments - admin mutations require company (controller)", () => {
    let jwtAdminWithoutCompany: string;
    let assignmentDienstId: string;
    const ASSIGN_WEEK_START = "2031-05-04";
    const ASSIGN_DAY = "2031-05-06";
    const ASSIGN_DIENST_NUM = 79;

    const partialBody = {
      assignments: [
        {
          date: ASSIGN_DAY,
          startTime: "08:00",
          endTime: "16:00",
        },
      ],
    };

    beforeAll(async () => {
      jwtAdminWithoutCompany = jwt.sign(
        { userId: adminId, role: "admin" },
        env.JWT_SECRET,
        { expiresIn: "1h" },
      );
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: ASSIGN_DIENST_NUM,
          weekStartDate: ASSIGN_WEEK_START,
          weekEndDate: "2031-05-10",
          assignments: [
            {
              date: ASSIGN_DAY,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
      assignmentDienstId = createRes.body._id ?? createRes.body.id;
    });

    it("admin sin companyId recibe 403 en PATCH /diensts/:id (updateDienstPartial)", async () => {
      const res = await request(app)
        .patch(`${API}/diensts/${assignmentDienstId}`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .send(partialBody)
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en PATCH /diensts/:id/remove-assignment", async () => {
      const res = await request(app)
        .patch(`${API}/diensts/${assignmentDienstId}/remove-assignment`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .send({ date: ASSIGN_DAY })
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin sin companyId recibe 403 en POST /diensts/clear-week-people", async () => {
      const res = await request(app)
        .post(`${API}/diensts/clear-week-people`)
        .set("Authorization", `Bearer ${jwtAdminWithoutCompany}`)
        .send({ dienstNumber: ASSIGN_DIENST_NUM, weekStartDate: ASSIGN_WEEK_START })
        .expect(403);
      expect(res.body.message).toMatch(/empresa|permiso/i);
    });

    it("admin con empresa puede PATCH partial, remove-assignment y clear-week-people", async () => {
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 80,
          weekStartDate: "2031-06-01",
          weekEndDate: "2031-06-07",
          assignments: [
            {
              date: "2031-06-02",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
      const id = createRes.body._id ?? createRes.body.id;
      await request(app)
        .patch(`${API}/diensts/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          assignments: [
            {
              date: "2031-06-02",
              startTime: "08:00",
              endTime: "16:00",
            },
          ],
        })
        .expect(200);
      await request(app)
        .patch(`${API}/diensts/${id}/remove-assignment`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ date: "2031-06-02" })
        .expect(200);
      await request(app)
        .post(`${API}/diensts/clear-week-people`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ dienstNumber: 80, weekStartDate: "2031-06-01" })
        .expect(200);
    });
  });

  describe("Workday Summary - POST y POST /partial (ownership)", () => {
    const DATE_FULL = "2030-11-10";
    const DATE_PARTIAL = "2030-11-11";
    const minimalTrip = {
      auftragNumber: "WS-P-1",
      patientName: "Paciente",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1 as const,
    };
    let ambulanceId: string;
    let assignmentIdParticipant: string;
    let assignmentIdNoParticipant: string;

    beforeAll(async () => {
      ambulanceId = sharedAmbulanceId;
      const ambForDienst = ambulanceId;
      const d1 = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 90,
          weekStartDate: "2030-11-07",
          weekEndDate: "2030-11-13",
          assignments: [
            {
              date: DATE_FULL,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: ambForDienst,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
      assignmentIdParticipant =
        d1.body.assignments?.[0]?._id?.toString() ?? d1.body.assignments?.[0]?.id ?? "";

      const d2 = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 91,
          weekStartDate: "2030-11-07",
          weekEndDate: "2030-11-13",
          assignments: [
            {
              date: DATE_FULL,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: ambForDienst,
              driver: adminId,
              medic: adminId,
            },
          ],
        })
        .expect(201);
      assignmentIdNoParticipant =
        d2.body.assignments?.[0]?._id?.toString() ?? d2.body.assignments?.[0]?.id ?? "";
    });

    const basePayloadFull = (assignmentId: string, date: string) => ({
      date,
      assignmentId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      finalKm: 10,
      trips: [minimalTrip],
      extraNote: "Test",
    });

    const basePayloadPartial = (assignmentId: string, date: string) => ({
      ...basePayloadFull(assignmentId, date),
      partialClosureReason: "Fin de turno anticipado",
    });

    describe("POST /api/workday-summary", () => {
      it("sin token devuelve 401", async () => {
        await request(app)
          .post(`${API}/workday-summary`)
          .send(basePayloadFull(assignmentIdParticipant, DATE_FULL))
          .expect(401);
      });

      it("admin con assignment válido devuelve 201", async () => {
        const res = await request(app)
          .post(`${API}/workday-summary`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send(basePayloadFull(assignmentIdParticipant, DATE_FULL))
          .expect(201);
        expect(res.body).toHaveProperty("_id");
        expect(res.body.date).toBe(DATE_FULL);
      });

      it("worker participante devuelve 201", async () => {
        const res = await request(app)
          .post(`${API}/workday-summary`)
          .set("Authorization", `Bearer ${workerToken}`)
          .send(basePayloadFull(assignmentIdParticipant, "2030-11-12"))
          .expect(201);
        expect(res.body).toHaveProperty("_id");
      });

      it("worker no participante devuelve 403", async () => {
        const res = await request(app)
          .post(`${API}/workday-summary`)
          .set("Authorization", `Bearer ${workerToken}`)
          .send(basePayloadFull(assignmentIdNoParticipant, DATE_FULL))
          .expect(403);
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toContain("No autorizado");
      });

      it("assignment inexistente devuelve 404", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
          .post(`${API}/workday-summary`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send(basePayloadFull(fakeId, DATE_FULL))
          .expect(404);
        expect(res.body).toHaveProperty("message");
      });
    });

    describe("POST /api/workday-summary/partial", () => {
      it("sin token devuelve 401", async () => {
        await request(app)
          .post(`${API}/workday-summary/partial`)
          .send(basePayloadPartial(assignmentIdParticipant, DATE_PARTIAL))
          .expect(401);
      });

      it("admin con assignment válido devuelve 201", async () => {
        const res = await request(app)
          .post(`${API}/workday-summary/partial`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send(basePayloadPartial(assignmentIdParticipant, DATE_PARTIAL))
          .expect(201);
        expect(res.body).toHaveProperty("message");
      });

      it("worker participante devuelve 201", async () => {
        const res = await request(app)
          .post(`${API}/workday-summary/partial`)
          .set("Authorization", `Bearer ${workerToken}`)
          .send(basePayloadPartial(assignmentIdParticipant, "2030-11-13"))
          .expect(201);
        expect(res.body).toHaveProperty("message");
      });

      it("worker no participante devuelve 403", async () => {
        const res = await request(app)
          .post(`${API}/workday-summary/partial`)
          .set("Authorization", `Bearer ${workerToken}`)
          .send(basePayloadPartial(assignmentIdNoParticipant, DATE_PARTIAL))
          .expect(403);
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toContain("No autorizado");
      });

      it("assignment inexistente devuelve 404", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
          .post(`${API}/workday-summary/partial`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send(basePayloadPartial(fakeId, DATE_PARTIAL))
          .expect(404);
        expect(res.body).toHaveProperty("message");
      });

      it("driver y medic falsos en body se ignoran; se usan los del assignment", async () => {
        const fakeDriver = "507f1f77bcf86cd799439011";
        const fakeMedic = "507f1f77bcf86cd799439012";
        const dateDm = "2030-11-14";
        const payload = {
          ...basePayloadPartial(assignmentIdParticipant, dateDm),
          driver: fakeDriver,
          medic: fakeMedic,
        };
        await request(app)
          .post(`${API}/workday-summary/partial`)
          .set("Authorization", `Bearer ${workerToken}`)
          .send(payload)
          .expect(201);

        const allRes = await request(app)
          .get(`${API}/workday-summary`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
        const found = allRes.body.find(
          (s: { assignmentId?: string; isFinalClosure?: boolean; date?: string }) =>
            s.assignmentId === assignmentIdParticipant &&
            s.isFinalClosure === false &&
            s.date === dateDm,
        );
        expect(found).toBeDefined();
        const toIdStr = (v: unknown) => {
          if (!v) return "";
          if (typeof v === "string") return v;
          const o = v as { _id?: unknown };
          if (o._id) return (o._id as { toString?: () => string }).toString?.() ?? String(o._id);
          return (v as { toString?: () => string }).toString?.() ?? "";
        };
        expect(toIdStr(found.driver)).toBe(adminId);
        expect(toIdStr(found.medic)).toBe(workerId);
      });
    });
  });

  describe("Validación ObjectId", () => {
    it("GET /api/users/:id con ObjectId inválido devuelve 400", async () => {
      const res = await request(app)
        .get(`${API}/users/id-invalido-xyz`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("ID inválido");
    });
  });

  describe("Dienst - searchDienst", () => {
    it("GET /api/diensts/search sin token devuelve 401", async () => {
      const res = await request(app)
        .get(`${API}/diensts/search`)
        .expect(401);
      expect(res.body).toHaveProperty("message");
    });

    it("GET /api/diensts/search con token worker devuelve 403", async () => {
      const res = await request(app)
        .get(`${API}/diensts/search`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });

    it("GET /api/diensts/search con token admin devuelve 200 y array", async () => {
      const res = await request(app)
        .get(`${API}/diensts/search`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/diensts/search con dienstNumber devuelve 200", async () => {
      const res = await request(app)
        .get(`${API}/diensts/search?dienstNumber=1`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Dienst - getAssignedDaysForUser", () => {
    it("GET /api/diensts/assigned-days/:userId sin token devuelve 401", async () => {
      await request(app)
        .get(`${API}/diensts/assigned-days/${workerId}`)
        .expect(401);
    });

    it("GET /api/diensts/assigned-days/:userId con userId inválido (admin) devuelve 400", async () => {
      const res = await request(app)
        .get(`${API}/diensts/assigned-days/id-invalido-xyz`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("userId inválido");
    });

    it("GET /api/diensts/assigned-days/:userId worker con otro userId ignora param y recibe sus datos (IDOR fix)", async () => {
      const resWorker = await request(app)
        .get(`${API}/diensts/assigned-days/${workerId}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      const resWorkerWithAdminId = await request(app)
        .get(`${API}/diensts/assigned-days/${adminId}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(resWorkerWithAdminId.body).toEqual(resWorker.body);
    });

    it("GET /api/diensts/assigned-days/:userId con userId válido devuelve 200 y array", async () => {
      const res = await request(app)
        .get(`${API}/diensts/assigned-days/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("dienstId");
        expect(res.body[0]).toHaveProperty("assignmentId");
        expect(res.body[0]).toHaveProperty("date");
        expect(res.body[0]).toHaveProperty("startTime");
        expect(res.body[0]).toHaveProperty("endTime");
      }
    });
  });

  describe("Dienst - getDienstsByUser (user/:userId) - IDOR fix", () => {
    beforeAll(async () => {
      await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 79,
          weekStartDate: "2030-06-01",
          weekEndDate: "2030-06-07",
          assignments: [
            {
              date: "2030-06-03",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
    });

    it("GET /api/diensts/user/:userId sin token devuelve 401", async () => {
      await request(app)
        .get(`${API}/diensts/user/${workerId}`)
        .expect(401);
    });

    it("GET /api/diensts/user/:userId admin con workerId devuelve 200", async () => {
      const res = await request(app)
        .get(`${API}/diensts/user/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/diensts/user/:userId worker con workerId devuelve 200", async () => {
      const res = await request(app)
        .get(`${API}/diensts/user/${workerId}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/diensts/user/:userId worker con adminId ignora param y recibe sus datos (IDOR fix)", async () => {
      const resWorker = await request(app)
        .get(`${API}/diensts/user/${workerId}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      const resWorkerWithAdminId = await request(app)
        .get(`${API}/diensts/user/${adminId}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(resWorkerWithAdminId.body).toEqual(resWorker.body);
    });
  });

  describe("Dienst - getDienstById (GET /:id) - IDOR fix", () => {
    let dienstIdConWorker: string;
    let dienstIdSinWorker: string;

    beforeAll(async () => {
      const createRes1 = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 89,
          weekStartDate: "2031-07-01",
          weekEndDate: "2031-07-07",
          assignments: [
            {
              date: "2031-07-02",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        })
        .expect(201);
      dienstIdConWorker = createRes1.body._id ?? createRes1.body.id;

      const createRes2 = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 90,
          weekStartDate: "2031-07-08",
          weekEndDate: "2031-07-14",
          assignments: [
            {
              date: "2031-07-09",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: adminId,
            },
          ],
        })
        .expect(201);
      dienstIdSinWorker = createRes2.body._id ?? createRes2.body.id;
    });

    it("GET /api/diensts/:id sin token devuelve 401", async () => {
      await request(app)
        .get(`${API}/diensts/${dienstIdConWorker}`)
        .expect(401);
    });

    it("GET /api/diensts/:id admin puede acceder a cualquier Dienst", async () => {
      const resConWorker = await request(app)
        .get(`${API}/diensts/${dienstIdConWorker}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(resConWorker.body).toHaveProperty("dienstNumber", 89);

      const resSinWorker = await request(app)
        .get(`${API}/diensts/${dienstIdSinWorker}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(resSinWorker.body).toHaveProperty("dienstNumber", 90);
    });

    it("GET /api/diensts/:id worker accede a Dienst donde participa", async () => {
      const res = await request(app)
        .get(`${API}/diensts/${dienstIdConWorker}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);
      expect(res.body).toHaveProperty("dienstNumber", 89);
      expect(res.body).toHaveProperty("assignments");
    });

    it("GET /api/diensts/:id worker con Dienst ajeno devuelve 403 (IDOR fix)", async () => {
      const res = await request(app)
        .get(`${API}/diensts/${dienstIdSinWorker}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(403);
      expect(res.body).toHaveProperty("message", "No autorizado");
    });

    it("GET /api/diensts/:id con Dienst inexistente devuelve 404", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`${API}/diensts/${fakeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
      expect(res.body).toHaveProperty("message", "Dienst no encontrado");
    });
  });

  describe("Dienst - generate-week", () => {
    beforeAll(async () => {
      const db = mongoose.connection.db;
      if (db) {
        await db.collection("diensttemplates").deleteMany({});
      }
    });

    it("POST /api/diensts/generate-week sin token devuelve 401", async () => {
      await request(app)
        .post(`${API}/diensts/generate-week`)
        .send({ weekStartDate: "2040-01-06" })
        .expect(401);
    });

    it("POST /api/diensts/generate-week con token worker devuelve 403", async () => {
      const res = await request(app)
        .post(`${API}/diensts/generate-week`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ weekStartDate: "2040-01-06" })
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });

    it("POST /api/diensts/generate-week sin weekStartDate devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/diensts/generate-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Fecha de inicio requerida");
    });

    it("POST /api/diensts/generate-week con weekStartDate inválida devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/diensts/generate-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ weekStartDate: "fecha-invalida" })
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("inválida");
    });

    it("POST /api/diensts/generate-week si no hay plantillas activas devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/diensts/generate-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ weekStartDate: "2040-02-03" })
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("plantillas");
    });

    it("POST /api/diensts/generate-week si ya existen Diensts para esa semana devuelve 400", async () => {
      await request(app)
        .post(`${API}/diensts/templates`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          startTime: "08:00",
          endTime: "16:00",
          daysOff: [],
          isActive: true,
        });

      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2040-01-06",
          weekEndDate: "2040-01-12",
          assignments: [
            {
              date: "2040-01-06",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        });
      expect(createRes.status).toBe(201);

      const res = await request(app)
        .post(`${API}/diensts/generate-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ weekStartDate: "2040-01-06" })
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Ya existen");
    });

    it("POST /api/diensts/generate-week happy path devuelve 201 e inserta Diensts", async () => {
      const targetWeek = "2040-03-03";
      const start = new Date(targetWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const Dienst = mongoose.model("Dienst");
      await Dienst.deleteMany({
        weekStartDate: { $gte: start, $lte: end },
      });

      const res = await request(app)
        .post(`${API}/diensts/generate-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ weekStartDate: targetWeek })
        .expect(201);
      expect(res.body).toHaveProperty("count");
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("dienstSummaries");
      expect(Array.isArray(res.body.dienstSummaries)).toBe(true);

      const listRes = await request(app)
        .get(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      const diensts = listRes.body;
      const weekDiensts = diensts.filter(
        (d: { weekStartDate?: string }) =>
          d.weekStartDate && String(d.weekStartDate).startsWith("2040-03"),
      );
      expect(weekDiensts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Dienst - assignTeamToWeek", () => {
    it("POST /api/diensts/assign-team-to-week sin token devuelve 401", async () => {
      await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-01-06",
          teamId: "507f1f77bcf86cd799439011",
        })
        .expect(401);
    });

    it("POST /api/diensts/assign-team-to-week con token worker devuelve 403", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-01-06",
          teamId: "507f1f77bcf86cd799439011",
        })
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });

    it("POST /api/diensts/assign-team-to-week sin params obligatorios devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Faltan parámetros");
    });

    it("POST /api/diensts/assign-team-to-week con teamId inválido devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-01-06",
          teamId: "id-invalido",
        })
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("teamId inválido");
    });

    it("POST /api/diensts/assign-team-to-week con team inexistente devuelve 404", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-01-06",
          teamId: "507f1f77bcf86cd799439011",
        })
        .expect(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Team no encontrado");
    });

    it("POST /api/diensts/assign-team-to-week con Dienst inexistente devuelve 404", async () => {
      if (!teamId) return;
      const res = await request(app)
        .post(`${API}/diensts/assign-team-to-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2099-06-01",
          teamId,
        })
        .expect(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("No existe Dienst");
    });
  });

  describe("Dienst - PATCH /:id (updateDienstPartial)", () => {
    let dienstIdForPatch: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 99,
          weekStartDate: "2030-02-01",
          weekEndDate: "2030-02-07",
          assignments: [
            {
              date: "2030-02-01",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        });
      if (createRes.status === 201) {
        dienstIdForPatch = createRes.body._id ?? createRes.body.id;
      }
    });

    it("PATCH /api/diensts/:id sin token devuelve 401", async () => {
      await request(app)
        .patch(`${API}/diensts/507f1f77bcf86cd799439011`)
        .send({
          assignments: [
            { date: "2030-01-06", startTime: "08:00", endTime: "16:00" },
          ],
        })
        .expect(401);
    });

    it("PATCH /api/diensts/:id con token worker devuelve 403", async () => {
      const res = await request(app)
        .patch(`${API}/diensts/507f1f77bcf86cd799439011`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          assignments: [
            { date: "2030-01-06", startTime: "08:00", endTime: "16:00" },
          ],
        })
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });

    it("PATCH /api/diensts/:id con Dienst inexistente devuelve 404", async () => {
      const res = await request(app)
        .patch(`${API}/diensts/507f1f77bcf86cd799439011`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          assignments: [
            { date: "2030-01-06", startTime: "08:00", endTime: "16:00" },
          ],
        })
        .expect(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Dienst no encontrado");
    });

    it("PATCH /api/diensts/:id happy path merge devuelve 200", async () => {
      expect(dienstIdForPatch).toBeDefined();
      const res = await request(app)
        .patch(`${API}/diensts/${dienstIdForPatch}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          assignments: [
            {
              date: "2030-02-01",
              startTime: "08:00",
              endTime: "16:00",
              driver: adminId,
            },
          ],
        })
        .expect(200);
      expect(res.body).toHaveProperty("assignments");
      expect(Array.isArray(res.body.assignments)).toBe(true);
      expect(res.body.assignments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Dienst - assignUserToWeek", () => {
    let dienstIdForAssignUser: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-03-01",
          weekEndDate: "2030-03-07",
          assignments: [
            {
              date: "2030-03-01",
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: sharedAmbulanceId,
              driver: adminId,
              medic: workerId,
            },
          ],
        });
      if (createRes.status === 201) {
        dienstIdForAssignUser = createRes.body._id ?? createRes.body.id;
      }
    });

    it("POST /api/diensts/assign-user-to-week sin token devuelve 401", async () => {
      await request(app)
        .post(`${API}/diensts/assign-user-to-week`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-03-01",
          userId: workerId,
          role: "medic",
        })
        .expect(401);
    });

    it("POST /api/diensts/assign-user-to-week con token worker devuelve 403", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-user-to-week`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-03-01",
          userId: workerId,
          role: "medic",
        })
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });

    it("POST /api/diensts/assign-user-to-week con Dienst inexistente devuelve 404", async () => {
      const res = await request(app)
        .post(`${API}/diensts/assign-user-to-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2099-06-01",
          userId: workerId,
          role: "medic",
        })
        .expect(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("No existe Dienst");
    });

    it("POST /api/diensts/assign-user-to-week happy path devuelve 200", async () => {
      expect(dienstIdForAssignUser).toBeDefined();
      const res = await request(app)
        .post(`${API}/diensts/assign-user-to-week`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dienstNumber: 1,
          weekStartDate: "2030-03-01",
          userId: workerId,
          role: "medic",
        })
        .expect(200);
      expect(res.body).toHaveProperty("updatedCount");
      expect(res.body).toHaveProperty("dienstId");
      expect(typeof res.body.updatedCount).toBe("number");
    });
  });

  describe("Mechanics module gate", () => {
    it("GET /mechanics/issues devuelve 403 si la empresa no tiene mechanics", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.MECHANICS },
      });
      try {
        const res = await request(app)
          .get(`${API}/mechanics/issues`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/mechanics/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.MECHANICS },
        });
      }
    });
  });

  describe("Workday module gate", () => {
    it("GET /api/workday-summary devuelve 403 si workday desactivada", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: {
          enabledModules: { $in: [MODULE_KEYS.WORKDAY, MODULE_KEYS.PRAEMIEN] },
        },
      });
      try {
        const res = await request(app)
          .get(`${API}/workday-summary`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/workday/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: {
            enabledModules: { $each: [MODULE_KEYS.WORKDAY, MODULE_KEYS.PRAEMIEN] },
          },
        });
      }
    });

    it("GET /api/trips/date/:date devuelve 403 si workday desactivada", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: {
          enabledModules: { $in: [MODULE_KEYS.WORKDAY, MODULE_KEYS.PRAEMIEN] },
        },
      });
      try {
        const res = await request(app)
          .get(`${API}/trips/date/2024-06-01`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/workday/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: {
            enabledModules: { $each: [MODULE_KEYS.WORKDAY, MODULE_KEYS.PRAEMIEN] },
          },
        });
      }
    });
  });

  describe("Scheduling module gate (diensts + templates)", () => {
    it("GET /api/diensts devuelve 403 si scheduling desactivada", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.SCHEDULING },
      });
      try {
        const res = await request(app)
          .get(`${API}/diensts`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/scheduling/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.SCHEDULING },
        });
      }
    });

    it("GET /api/diensts/templates devuelve 403 si scheduling desactivada", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.SCHEDULING },
      });
      try {
        const res = await request(app)
          .get(`${API}/diensts/templates`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/scheduling/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.SCHEDULING },
        });
      }
    });
  });

  describe("Company modules: automatic Praemien requires workday", () => {
    it("PATCH /api/companies/:id devuelve 400 si Prämien automático sin workday", async () => {
      const { superadminToken } = await createTestSuperadmin();
      const modulesMissingWorkday = V1_DEFAULT_MODULES.filter(
        (k) => k !== MODULE_KEYS.WORKDAY,
      );
      const res = await request(app)
        .patch(`${API}/companies/${companyId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ enabledModules: modulesMissingWorkday })
        .expect(400);
      expect(res.body.message).toMatch(
        /automático|workday|jornada|Prämien|praemien|manual|papel/i,
      );
    });

    it("PATCH /api/companies/:id devuelve 200 con Prämien manual sin workday (papel)", async () => {
      const { superadminToken } = await createTestSuperadmin();
      const modulesNoWorkday = V1_DEFAULT_MODULES.filter(
        (k) => k !== MODULE_KEYS.WORKDAY,
      );
      try {
        const res = await request(app)
          .patch(`${API}/companies/${companyId}`)
          .set("Authorization", `Bearer ${superadminToken}`)
          .send({
            enabledModules: modulesNoWorkday,
            praemienMode: "manual",
          })
          .expect(200);
        expect(res.body.enabledModules).not.toContain(MODULE_KEYS.WORKDAY);
        expect(res.body.enabledModules).toContain(MODULE_KEYS.PRAEMIEN);
        expect(res.body.praemienMode).toBe("manual");
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $set: {
            enabledModules: [...V1_DEFAULT_MODULES],
            praemienMode: "automatic",
            praemienModeEffectiveFrom: null,
          },
        });
      }
    });
  });

});
