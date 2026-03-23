/**
 * Tests de integración para Invitations.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany, createTestUsers } from "./test-helpers";
import Invitation from "../modules/invitations/models/invitation.model";
import User from "../modules/users/models/user.model";

const API = "/api";

describe("Invitations - flujo base", () => {
  let sharedAdminToken: string;
  let sharedCompanyId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    sharedAdminToken = data.adminToken;
    sharedCompanyId = data.companyId;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("POST /api/invitations", () => {
    it("admin con companyId crea invitación y devuelve token", async () => {
      const email = `invited-${Date.now()}@example.com`;

      const res = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email, role: "worker" })
        .expect(201);

      expect(res.body).toHaveProperty("invitationId");
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("expiresAt");
      expect(res.body.email).toBe(email.toLowerCase());
      expect(res.body.role).toBe("worker");

      const inv = await Invitation.findById(res.body.invitationId).lean();
      expect(inv).not.toBeNull();
      expect(inv?.email).toBe(email.toLowerCase());
      expect(inv?.role).toBe("worker");
      expect(inv?.tokenHash).toBeDefined();
      expect(inv?.tokenHash).not.toBe(res.body.token);
    });

    it("rechaza crear invitación si falta companyId (admin sin empresa)", async () => {
      const { adminToken } = await createTestUsers();

      const res = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "test@example.com", role: "worker" })
        .expect(403);

      expect(res.body.message).toContain("empresa");
    });

    it("sin token devuelve 401", async () => {
      await request(app)
        .post(`${API}/invitations`)
        .send({ email: "test@example.com", role: "worker" })
        .expect(401);
    });

    it("worker con companyId devuelve 403", async () => {
      const workerEmail = `worker-role-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email: workerEmail, role: "worker" })
        .expect(201);

      await request(app)
        .post(`${API}/invitations/accept`)
        .send({
          token: createRes.body.token,
          name: "Worker",
          lastName: "Invited",
          password: "password123",
        })
        .expect(201);

      const loginRes = await request(app)
        .post(`${API}/users/login`)
        .send({ email: workerEmail, password: "password123" });

      await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${loginRes.body.token}`)
        .send({ email: `other-${Date.now()}@example.com`, role: "worker" })
        .expect(403);
    });
  });

  describe("GET /api/invitations/validate", () => {
    it("token correcto devuelve valid: true y datos mínimos", async () => {
      const email = `validate-ok-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email, role: "worker" })
        .expect(201);

      const res = await request(app)
        .get(`${API}/invitations/validate?token=${createRes.body.token}`)
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.email).toBe(email.toLowerCase());
      expect(res.body.role).toBe("worker");
      expect(res.body.companyName).toBeDefined();
      expect(res.body).not.toHaveProperty("tokenHash");
    });

    it("token inexistente devuelve valid: false", async () => {
      const res = await request(app)
        .get(`${API}/invitations/validate?token=token-inexistente-xyz`)
        .expect(200);

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBeDefined();
    });

    it("token ya aceptado devuelve valid: false", async () => {
      const email = `validate-used-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email, role: "worker" })
        .expect(201);

      await request(app)
        .post(`${API}/invitations/accept`)
        .send({
          token: createRes.body.token,
          name: "Used",
          lastName: "User",
          password: "password123",
        })
        .expect(201);

      const res = await request(app)
        .get(`${API}/invitations/validate?token=${createRes.body.token}`)
        .expect(200);

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toContain("utilizada");
    });
  });

  describe("POST /api/invitations/accept", () => {
    it("acepta invitación y crea user con companyId e invitationId", async () => {
      const email = `accept-ok-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email, role: "worker" })
        .expect(201);

      const res = await request(app)
        .post(`${API}/invitations/accept`)
        .send({
          token: createRes.body.token,
          name: "Accepted",
          lastName: "User",
          password: "password123",
        })
        .expect(201);

      expect(res.body.email).toBe(email.toLowerCase());
      expect(res.body.name).toBe("Accepted");
      expect(res.body.lastName).toBe("User");
      expect(res.body.role).toBe("worker");
      expect(res.body.companyId).toBe(sharedCompanyId);
      expect(res.body.invitationId).toBeDefined();
      expect(res.body).not.toHaveProperty("password");

      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      expect(user?.companyId?.toString()).toBe(sharedCompanyId);
      expect(user?.invitationId).toBeDefined();
    });

    it("rechaza reutilización de la misma invitación", async () => {
      const email = `accept-reuse-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email, role: "worker" })
        .expect(201);

      await request(app)
        .post(`${API}/invitations/accept`)
        .send({
          token: createRes.body.token,
          name: "First",
          lastName: "User",
          password: "password123",
        })
        .expect(201);

      const res = await request(app)
        .post(`${API}/invitations/accept`)
        .send({
          token: createRes.body.token,
          name: "Second",
          lastName: "User",
          password: "password456",
        })
        .expect(400);

      expect(res.body.message).toContain("utilizada");
    });

    it("rechaza si email ya existe", async () => {
      const email = `existing-${Date.now()}@example.com`;

      await request(app).post(`${API}/users/register`).send({
        name: "Existing",
        lastName: "User",
        email,
        password: "password123",
      });

      const createRes = await request(app)
        .post(`${API}/invitations`)
        .set("Authorization", `Bearer ${sharedAdminToken}`)
        .send({ email, role: "worker" })
        .expect(201);

      const res = await request(app)
        .post(`${API}/invitations/accept`)
        .send({
          token: createRes.body.token,
          name: "Invited",
          lastName: "User",
          password: "password456",
        })
        .expect(409);

      expect(res.body.message).toContain("Ya existe");
    });
  });
});
