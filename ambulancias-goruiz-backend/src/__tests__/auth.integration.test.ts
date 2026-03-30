/**
 * Tests de integración para Auth - registro y seguridad.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Fase 8B: registro público desactivado. Onboarding solo por invitación o primer admin.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  createTestWorkerUser,
} from "./test-helpers";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";

const API = "/api";

describe("Auth - register desactivado (8B)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("POST /api/users/register devuelve 403 - registro público deshabilitado", async () => {
    const res = await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "User",
        lastName: "Test",
        email: `test-${Date.now()}@example.com`,
        password: "password123",
      })
      .expect(403);

    expect(res.body.message).toMatch(/deshabilitado|invitación/i);
  });

  it("POST /api/users/register con role=admin devuelve 403", async () => {
    const res = await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "Hacker",
        lastName: "Admin",
        email: `hacker-${Date.now()}@test.com`,
        password: "123456",
        role: "admin",
      })
      .expect(403);

    expect(res.body.message).toMatch(/deshabilitado|invitación/i);
  });

  it("POST /api/users/login succeeds for worker with companyId", async () => {
    const data = await createTestAdminWithCompany();
    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(data.companyId),
      Date.now(),
    );
    try {
      const res = await request(app)
        .post(`${API}/users/login`)
        .send({ email: worker.email, password: "password123" })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
    } finally {
      await User.deleteOne({ _id: worker._id });
      await User.deleteOne({ _id: data.adminId });
      await Company.deleteOne({ _id: data.companyId });
    }
  });

  it("POST /api/users/login rejects worker without companyId", async () => {
    const worker = await createTestWorkerUser(`login-noco-${Date.now()}@example.com`);
    try {
      const res = await request(app)
        .post(`${API}/users/login`)
        .send({ email: worker.email, password: "password123" })
        .expect(403);

      expect(res.body.message).toMatch(/empresa/i);
    } finally {
      await User.deleteOne({ _id: worker._id });
    }
  });
});
