/**
 * Tests de integración para rutas críticas.
 * Requiere .env.test con MONGODB_URI y JWT_SECRET.
 * Usa una DB real (recomendado: ambulancias_test).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";

const API = "/api";

describe("API - Rutas críticas", () => {
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let adminId: string;
  let teamId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
    const suffix = Date.now();
    const adminEmail = `admin-test-${suffix}@example.com`;
    const workerEmail = `worker-test-${suffix}@example.com`;
    await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "Admin",
        lastName: "Test",
        email: adminEmail,
        password: "password123",
        role: "admin",
      });
    await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "Worker",
        lastName: "Test",
        email: workerEmail,
        password: "password123",
        role: "worker",
      });
    const adminRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: adminEmail, password: "password123" });
    const workerRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerEmail, password: "password123" });
    adminToken = adminRes.body.token;
    workerToken = workerRes.body.token;
    workerId = workerRes.body.user?._id ?? "";
    adminId = adminRes.body.user?._id ?? "";

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
    it("POST /api/workday-summary/report-issue sin token devuelve 401", async () => {
      const res = await request(app)
        .post(`${API}/workday-summary/report-issue`)
        .send({ summary: "test", description: "test" })
        .expect(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("Auth - issues (solo admin)", () => {
    it("GET /api/workday-summary/issues sin token devuelve 401", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary/issues`)
        .expect(401);
      expect(res.body).toHaveProperty("message");
    });

    it("GET /api/workday-summary/issues con token worker devuelve 403", async () => {
      const res = await request(app)
        .get(`${API}/workday-summary/issues`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(403);
      expect(res.body).toHaveProperty("message");
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

    it("GET /api/diensts/assigned-days/:userId con userId inválido devuelve 400", async () => {
      const res = await request(app)
        .get(`${API}/diensts/assigned-days/id-invalido-xyz`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("ID inválido");
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
              ambulanceId: "507f1f77bcf86cd799439011",
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
              ambulanceId: "507f1f77bcf86cd799439011",
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
});
