/**
 * Tests de integración para rutas críticas.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Usa una DB real dedicada para tests (ej: ambulancias_test).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";

const API = "/api";

describe("API - Rutas críticas", () => {
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let adminId: string;
  let teamId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
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
              ambulanceId: "507f1f77bcf86cd799439011",
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

  describe("Hospitals - updateHospital (PUT/PATCH)", () => {
    let hospitalId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Hospital Test Original",
          address: "Calle Test 1",
          phone: "+34 123 456 789",
          specialties: ["Urgencias", "Trauma"],
        });
      expect(createRes.status).toBe(201);
      hospitalId = createRes.body._id ?? createRes.body.id;
    });

    it("PUT /api/hospitals/:id sin token devuelve 401", async () => {
      await request(app)
        .put(`${API}/hospitals/${hospitalId}`)
        .send({ name: "Updated" })
        .expect(401);
    });

    it("PATCH /api/hospitals/:id con token worker devuelve 403", async () => {
      const res = await request(app)
        .patch(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ name: "Updated" })
        .expect(403);
      expect(res.body).toHaveProperty("message");
    });

    it("PUT /api/hospitals/:id con ObjectId inválido devuelve 400", async () => {
      const res = await request(app)
        .put(`${API}/hospitals/id-invalido-xyz`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated" })
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("ID inválido");
    });

    it("PUT /api/hospitals/:id con body inválido (name vacío) devuelve 400", async () => {
      const res = await request(app)
        .put(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "" })
        .expect(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/name/i);
    });

    it("PUT /api/hospitals/:id con body inválido (tipos incorrectos) devuelve 400", async () => {
      const res = await request(app)
        .put(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: 123, isOpen: "true" })
        .expect(400);
      expect(res.body).toHaveProperty("message");
    });

    it("PUT /api/hospitals/:id con hospital inexistente devuelve 404", async () => {
      const res = await request(app)
        .put(`${API}/hospitals/507f1f77bcf86cd799439011`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "No existe" })
        .expect(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("Hospital no encontrado");
    });

    it("PUT /api/hospitals/:id actualiza correctamente con campos permitidos", async () => {
      const res = await request(app)
        .put(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Hospital Actualizado",
          address: "Nueva dirección",
          phone: "+34 999 888 777",
          specialties: ["Cardiología", "Neurología"],
          isOpen: false,
        })
        .expect(200);
      expect(res.body.name).toBe("Hospital Actualizado");
      expect(res.body.address).toBe("Nueva dirección");
      expect(res.body.phone).toBe("+34 999 888 777");
      expect(res.body.specialties).toEqual(["Cardiología", "Neurología"]);
      expect(res.body.isOpen).toBe(false);
    });

    it("PATCH /api/hospitals/:id actualiza parcialmente (solo name)", async () => {
      const res = await request(app)
        .patch(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Solo Name Cambiado" })
        .expect(200);
      expect(res.body.name).toBe("Solo Name Cambiado");
      expect(res.body.address).toBe("Nueva dirección");
      expect(res.body.phone).toBe("+34 999 888 777");
    });

    it("PATCH /api/hospitals/:id ignora campos no permitidos y no los persiste", async () => {
      const res = await request(app)
        .patch(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Sin Campos Extra",
          extraField: "debe-ignorarse",
          maliciousField: 12345,
          _id: "507f1f77bcf86cd799439012",
        })
        .expect(200);
      expect(res.body.name).toBe("Sin Campos Extra");
      expect(res.body).not.toHaveProperty("extraField");
      expect(res.body).not.toHaveProperty("maliciousField");
      expect(res.body._id).toBe(hospitalId);
    });
  });

  describe("Praemien - monthly-summary / monthly-history (IDOR fix)", () => {
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

    it("admin con ?userId inválido devuelve 500 (sin validación explícita)", async () => {
      const res = await request(app)
        .get(`${API}/praemien/monthly-summary?userId=id-invalido`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(500);
      expect(res.body).toHaveProperty("message");
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
});
