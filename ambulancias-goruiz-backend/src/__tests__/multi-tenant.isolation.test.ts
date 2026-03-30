/**
 * Tests de integración para aislamiento multiempresa (users y messages).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 *
 * Usa un solo beforeAll para crear usuarios y evitar superar el rate limit de login (5/15min).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminUser,
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
} from "./test-helpers";
import User from "../modules/users/models/user.model";

const API = "/api";

type TestFixtures = {
  adminTokenNoCompany: string;
  dataA: { adminToken: string; companyId: string };
  dataB: { adminToken: string; companyId: string };
  workerBId: string;
};

let fixtures: TestFixtures;
let adminNoCompanyId: string;

describe("Multi-tenant isolation", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const adminNoCo = await createTestAdminUser(
      `mt-admin-noco-${Date.now()}@example.com`,
      "password123",
    );
    adminNoCompanyId = String(adminNoCo._id);

    const [dataA, dataB] = await Promise.all([
      createTestAdminWithCompany(),
      createTestAdminWithCompany(),
    ]);

    const [, workerB] = await Promise.all([
      createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataA.companyId),
        Date.now() + 1,
      ),
      createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataB.companyId),
        Date.now() + 2,
      ),
    ]);

    fixtures = {
      adminTokenNoCompany: issueTestJwt(adminNoCompanyId, "admin"),
      dataA: { adminToken: dataA.adminToken, companyId: dataA.companyId },
      dataB: { adminToken: dataB.adminToken, companyId: dataB.companyId },
      workerBId: String(workerB._id),
    };
  });

  afterAll(async () => {
    await User.deleteOne({ _id: adminNoCompanyId });
    await mongoose.disconnect();
  });

  describe("users", () => {
    it("admin sin companyId recibe 403 en GET /users", async () => {
      const res = await request(app)
        .get(`${API}/users`)
        .set("Authorization", `Bearer ${fixtures.adminTokenNoCompany}`)
        .expect(403);
      expect(res.body.message).toContain("empresa");
    });

    it("admin de empresa A solo lista usuarios de su empresa", async () => {
      const res = await request(app)
        .get(`${API}/users`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const u of res.body) {
        expect(u.companyId).toBe(fixtures.dataA.companyId);
      }
    });

    it("admin de empresa A no puede ver usuario de empresa B", async () => {
      const res = await request(app)
        .get(`${API}/users/${fixtures.workerBId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(403);
      expect(res.body.message).toContain("permiso");
    });

    it("admin de empresa A no puede editar usuario de empresa B", async () => {
      const res = await request(app)
        .patch(`${API}/users/${fixtures.workerBId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({ name: "Hacked" })
        .expect(403);
      expect(res.body.message).toContain("permiso");
    });

    it("admin de empresa A no puede eliminar usuario de empresa B", async () => {
      const res = await request(app)
        .delete(`${API}/users/${fixtures.workerBId}`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .expect(403);
      expect(res.body.message).toContain("permiso");
    });
  });

  describe("messages", () => {
    it("admin sin companyId recibe 403 en POST /messages", async () => {
      const res = await request(app)
        .post(`${API}/messages`)
        .set("Authorization", `Bearer ${fixtures.adminTokenNoCompany}`)
        .send({
          subject: "Test",
          body: "Body",
          toAllWorkers: true,
          recipients: [],
        })
        .expect(403);
      expect(res.body.message).toContain("empresa");
    });

    it("admin sin companyId recibe 403 en GET /messages/sent", async () => {
      const res = await request(app)
        .get(`${API}/messages/sent`)
        .set("Authorization", `Bearer ${fixtures.adminTokenNoCompany}`)
        .expect(403);
      expect(res.body.message).toContain("empresa");
    });

    it("admin de empresa A toAllWorkers solo incluye workers de empresa A", async () => {
      const res = await request(app)
        .post(`${API}/messages`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          subject: "To all",
          body: "Body",
          toAllWorkers: true,
          recipients: [],
        })
        .expect(201);
      expect(res.body.recipients).toBeDefined();
      const recipients = res.body.recipients as string[];
      for (const rid of recipients) {
        const u = await User.findById(rid);
        expect(u?.companyId?.toString()).toBe(fixtures.dataA.companyId);
      }
    });

    it("admin de empresa A no puede enviar a worker de empresa B (recipients filtrados)", async () => {
      const res = await request(app)
        .post(`${API}/messages`)
        .set("Authorization", `Bearer ${fixtures.dataA.adminToken}`)
        .send({
          subject: "Cross-company",
          body: "Should not reach B",
          toAllWorkers: false,
          recipients: [String(fixtures.workerBId)],
        })
        .expect(400);
      expect(res.body.message).toMatch(/Faltan|receptores|inválidos/i);
    });
  });
});
