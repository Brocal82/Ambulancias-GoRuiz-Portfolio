/**
 * Tests de integración para gestión de Company (superadmin).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestSuperadmin,
  createTestAdminWithCompany,
  createTestAdminUser,
  issueTestJwt,
} from "./test-helpers";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import { V1_DEFAULT_MODULES } from "../modules/companies/constants/modules.constants";

const API = "/api";

describe("Companies - gestión superadmin", () => {
  let superadminToken: string;
  let adminToken: string;
  let adminNoCompanyToken: string;
  let companyId: string;
  let legacyAdminId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const sa = await createTestSuperadmin();
    superadminToken = sa.superadminToken;

    const adminData = await createTestAdminWithCompany();
    adminToken = adminData.adminToken;
    companyId = adminData.companyId;

    const legacyAdmin = await createTestAdminUser(
      `legacy-${Date.now()}@example.com`,
      "password123",
    );
    legacyAdminId = String(legacyAdmin._id);
    adminNoCompanyToken = issueTestJwt(legacyAdminId, "admin");
  });

  afterAll(async () => {
    await User.deleteOne({ _id: legacyAdminId });
    await mongoose.disconnect();
  });

  describe("Autorización - solo superadmin", () => {
    it("admin de empresa no puede crear company", async () => {
      const res = await request(app)
        .post(`${API}/companies`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Nueva Empresa" });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/superadmin/i);
    });

    it("admin sin companyId no puede crear company", async () => {
      const res = await request(app)
        .post(`${API}/companies`)
        .set("Authorization", `Bearer ${adminNoCompanyToken}`)
        .send({ name: "Nueva Empresa" });
      expect(res.status).toBe(403);
    });

    it("admin de empresa no puede listar companies", async () => {
      const res = await request(app)
        .get(`${API}/companies`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it("admin de empresa no puede editar company", async () => {
      const res = await request(app)
        .patch(`${API}/companies/${companyId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Hacked" });
      expect(res.status).toBe(403);
    });
  });

  describe("Superadmin - CRUD companies", () => {
    it("superadmin puede crear company", async () => {
      const res = await request(app)
        .post(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: "Empresa Test SA", emailDomain: "@empresatest.com" })
        .expect(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.name).toBe("Empresa Test SA");
      expect(res.body.isActive).toBe(true);
    });

    it("superadmin puede listar companies", async () => {
      const res = await request(app)
        .get(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("superadmin puede ver company por id", async () => {
      const list = await request(app)
        .get(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);
      const firstId = list.body[0]?._id ?? list.body[0]?.id;
      if (!firstId) return;
      const res = await request(app)
        .get(`${API}/companies/${firstId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);
      expect(res.body).toHaveProperty("name");
    });

    it("superadmin puede actualizar company", async () => {
      const createRes = await request(app)
        .post(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: "Para Actualizar", emailDomain: "@paractualizar.com" })
        .expect(201);
      const id = createRes.body._id ?? createRes.body.id;
      const res = await request(app)
        .patch(`${API}/companies/${id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: "Actualizada OK", emailDomain: "@actualizadaok.com" })
        .expect(200);
      expect(res.body.name).toBe("Actualizada OK");
    });

    it("superadmin: último PATCH de praemienMode + praemienModeEffectiveFrom se persiste", async () => {
      const createRes = await request(app)
        .post(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: `Praemien patch ${Date.now()}`,
          emailDomain: "@praemienpatch.com",
          enabledModules: [...V1_DEFAULT_MODULES],
        })
        .expect(201);
      const id = createRes.body._id ?? createRes.body.id;
      const eff1 = { year: 2029, month: 4 };
      const eff2 = { year: 2029, month: 7 };

      await request(app)
        .patch(`${API}/companies/${id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailDomain: "@praemienpatch.com",
          enabledModules: [...V1_DEFAULT_MODULES],
          praemienMode: "manual",
          praemienModeEffectiveFrom: eff1,
        })
        .expect(200);

      await request(app)
        .patch(`${API}/companies/${id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailDomain: "@praemienpatch.com",
          enabledModules: [...V1_DEFAULT_MODULES],
          praemienMode: "automatic",
          praemienModeEffectiveFrom: eff2,
        })
        .expect(200);

      const doc = await Company.findById(id).lean();
      expect(doc?.praemienMode).toBe("automatic");
      expect(doc?.praemienModeEffectiveFrom).toEqual(eff2);
    });
  });

  describe("Superadmin - crear primer admin de empresa", () => {
    let newCompanyId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: "Empresa Sin Admin", emailDomain: "@empresasinadmin.com" })
        .expect(201);
      newCompanyId = createRes.body._id ?? createRes.body.id;
    });

    it("superadmin puede crear primer admin de empresa", async () => {
      const email = `primer-admin-${Date.now()}@empresa.com`;
      const res = await request(app)
        .post(`${API}/companies/${newCompanyId}/admin`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Primer",
          lastName: "Admin",
          email,
          password: "securepass123",
        })
        .expect(201);
      expect(res.body.user).toHaveProperty("_id");
      expect(res.body.user.role).toBe("admin");
      expect(String(res.body.user.companyId)).toBe(newCompanyId);
      expect(res.body.user.email).toBe(email);
    });

    it("admin creado tiene companyId correcto y puede hacer login", async () => {
      const email = `login-admin-${Date.now()}@empresa.com`;
      await request(app)
        .post(`${API}/companies/${newCompanyId}/admin`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Login",
          lastName: "Test",
          email,
          password: "password123",
        })
        .expect(201);
      const loginRes = await request(app)
        .post(`${API}/users/login`)
        .send({ email, password: "password123" })
        .expect(200);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.user?.companyId).toBe(newCompanyId);
      expect(loginRes.body.user?.role).toBe("admin");
    });

    it("email duplicado se rechaza", async () => {
      const email = `duplicado-${Date.now()}@empresa.com`;
      await request(app)
        .post(`${API}/companies/${newCompanyId}/admin`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Primero",
          lastName: "Admin",
          email,
          password: "pass12345678",
        })
        .expect(201);
      const res = await request(app)
        .post(`${API}/companies/${newCompanyId}/admin`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Segundo",
          lastName: "Admin",
          email,
          password: "pass12345678",
        });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/email|registrado/i);
    });

    it("company inexistente devuelve 404", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`${API}/companies/${fakeId}/admin`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "X",
          lastName: "Y",
          email: `x-${Date.now()}@test.com`,
          password: "password12345",
        });
      expect(res.status).toBe(404);
    });
  });

  describe("Login superadmin", () => {
    it("superadmin token de createTestSuperadmin permite acceso a companies", async () => {
      const res = await request(app)
        .get(`${API}/companies`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Bootstrap superadmin (lógica equivalente al script)", () => {
    it("crear superadmin directo en DB + login funciona", async () => {
      const bcrypt = await import("bcrypt");
      const User = (await import("../modules/users/models/user.model")).default;
      const email = `bootstrap-${Date.now()}@example.com`;
      const password = "securepass123";
      const hashedPassword = await bcrypt.default.hash(password, 10);
      await User.create({
        name: "Bootstrap",
        lastName: "Admin",
        email,
        password: hashedPassword,
        role: "superadmin",
      });
      const loginRes = await request(app)
        .post(`${API}/users/login`)
        .send({ email, password })
        .expect(200);
      expect(loginRes.body.token).toBeDefined();
      const companiesRes = await request(app)
        .get(`${API}/companies`)
        .set("Authorization", `Bearer ${loginRes.body.token}`)
        .expect(200);
      expect(Array.isArray(companiesRes.body)).toBe(true);
    });

    it("crear superadmin con email duplicado falla (como el script)", async () => {
      const User = (await import("../modules/users/models/user.model")).default;
      const existing = await User.findOne({ role: "superadmin" }).lean();
      if (!existing || !existing.email) return;
      const bcrypt = await import("bcrypt");
      let threw = false;
      try {
        await User.create({
          name: "Dup",
          lastName: "Admin",
          email: existing.email,
          password: await bcrypt.default.hash("password123", 10),
          role: "superadmin",
        });
      } catch (err: unknown) {
        threw = true;
        const e = err as { code?: number };
        expect(e.code === 11000 || (e as Error).message?.toLowerCase().includes("duplicate")).toBe(true);
      }
      expect(threw).toBe(true);
    });
  });
});
