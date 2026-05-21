/**
 * Tests de integración para Hospitals.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany, createTestWorkerInCompany } from "./test-helpers";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import { Trip } from "../modules/trips/models/trip.model";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";

const API = "/api";

describe("Hospitals integration", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("module gate and create validation", () => {
    let adminToken: string;
    let companyId: string;
    let fixtureWorkerId: string;

    beforeAll(async () => {
      const dataWithCompany = await createTestAdminWithCompany();
      adminToken = dataWithCompany.adminToken;
      companyId = dataWithCompany.companyId;
      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 500,
      );
      fixtureWorkerId = String(worker._id);
    });

    afterAll(async () => {
      await User.deleteOne({ _id: fixtureWorkerId });
    });

    it("GET /api/hospitals devuelve 403 si hospitals está desactivado", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.HOSPITALS },
      });
      try {
        const res = await request(app)
          .get(`${API}/hospitals`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/hospitals/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.HOSPITALS },
        });
      }
    });

    it("POST /api/hospitals con name vacío devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "   ",
          address: "Calle Test 1",
          phone: "+34 123",
          specialties: ["Urgencias"],
        })
        .expect(400);
      expect(res.body.message).toMatch(/name/i);
    });

    it("POST /api/hospitals con specialties no array devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Hospital Validación",
          address: "Calle Test 2",
          phone: "+34 123",
          specialties: "Urgencias",
        })
        .expect(400);
      expect(res.body).toHaveProperty("message");
    });

    it("POST /api/hospitals recorta strings y filtra specialties vacías", async () => {
      const res = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "  Hospital Trim  ",
          address: "  Calle Trim 1  ",
          phone: "  +34 555  ",
          specialties: [" Urgencias ", "", "  "],
        })
        .expect(201);
      expect(res.body.name).toBe("Hospital Trim");
      expect(res.body.address).toBe("Calle Trim 1");
      expect(res.body.phone).toBe("+34 555");
      expect(res.body.specialties).toEqual(["Urgencias"]);
    });
  });

  describe("updateHospital (PUT/PATCH)", () => {
    let adminToken: string;
    let workerToken: string;
    let hospitalId: string;
    let fixtureWorkerId: string;

    beforeAll(async () => {
      const dataWithCompany = await createTestAdminWithCompany();
      adminToken = dataWithCompany.adminToken;
      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataWithCompany.companyId),
        Date.now(),
      );
      fixtureWorkerId = String(worker._id);
      const wLogin = await request(app)
        .post(`${API}/users/login`)
        .send({ email: worker.email, password: "password123" });
      expect(wLogin.status).toBe(200);
      workerToken = wLogin.body.token as string;

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

    afterAll(async () => {
      await User.deleteOne({ _id: fixtureWorkerId });
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

  describe("delete protection", () => {
    let adminToken: string;
    let companyId: string;
    let hospitalId: string;

    beforeAll(async () => {
      const dataWithCompany = await createTestAdminWithCompany();
      adminToken = dataWithCompany.adminToken;
      companyId = dataWithCompany.companyId;

      const createRes = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Hospital Protegido",
          address: "Calle Protegida 9",
          phone: "+34 777",
          specialties: ["Urgencias"],
        });
      expect(createRes.status).toBe(201);
      hospitalId = createRes.body._id ?? createRes.body.id;
    });

    it("DELETE /api/hospitals/:id bloquea si hay trip con toAddress coincidente", async () => {
      const trip = await Trip.create({
        date: "2026-05-21",
        assignmentId: new mongoose.Types.ObjectId(),
        driver: new mongoose.Types.ObjectId(),
        medic: new mongoose.Types.ObjectId(),
        companyId: new mongoose.Types.ObjectId(companyId),
        auftragNumber: "DEL-1",
        patientName: "Paciente Test",
        fromAddress: "Origen",
        toAddress: "Hospital Protegido",
        timeWarning: "08:00",
        wasCancelled: false,
        countsTrip: 1,
        sentInSummary: false,
      });

      const res = await request(app)
        .delete(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.message).toMatch(/referenciado|viajes|jornadas/i);
      expect(res.body.sources).toContain("trips");

      await Trip.deleteOne({ _id: trip._id });
    });

    it("DELETE /api/hospitals/:id bloquea si workday-summary referencia destino", async () => {
      const summary = await WorkdaySummary.create({
        date: "2026-05-21",
        assignmentId: String(new mongoose.Types.ObjectId()),
        driver: new mongoose.Types.ObjectId(),
        medic: new mongoose.Types.ObjectId(),
        ambulanceId: new mongoose.Types.ObjectId(),
        companyId: new mongoose.Types.ObjectId(companyId),
        ambulanceNumber: "AMB-1",
        initialKm: 100,
        totalDienstKm: 120,
        trips: [
          {
            auftragNumber: "WD-1",
            patientName: "Paciente",
            fromAddress: "Origen",
            toAddress: "Calle Protegida 9",
            timeWarning: "09:00",
            wasCancelled: false,
            countsTrip: 1,
          },
        ],
        totalEffectivePatients: 1,
        totalRealTrips: 1,
      });

      const res = await request(app)
        .delete(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("workday-summary");

      await WorkdaySummary.deleteOne({ _id: summary._id });
    });

    it("DELETE /api/hospitals/:id elimina cuando no hay referencias", async () => {
      const res = await request(app)
        .delete(`${API}/hospitals/${hospitalId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.message).toMatch(/eliminado/i);
    });
  });

  describe("company isolation", () => {
    let adminTokenA: string;
    let adminTokenB: string;
    let hospitalIdB: string;

    beforeAll(async () => {
      const [dataA, dataB] = await Promise.all([
        createTestAdminWithCompany(),
        createTestAdminWithCompany(),
      ]);
      adminTokenA = dataA.adminToken;
      adminTokenB = dataB.adminToken;

      const createB = await request(app)
        .post(`${API}/hospitals`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .send({
          name: "Hospital Empresa B",
          address: "Calle B",
          phone: "+34 222",
          specialties: ["Trauma"],
        });
      hospitalIdB = createB.body._id ?? createB.body.id;
    });

    it("admin A no puede borrar hospital de empresa B", async () => {
      const res = await request(app)
        .delete(`${API}/hospitals/${hospitalIdB}`)
        .set("Authorization", `Bearer ${adminTokenA}`);
      expect(res.status).not.toBe(200);
      expect(res.status).not.toBe(409);
    });
  });
});
