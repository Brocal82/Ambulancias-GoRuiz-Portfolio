/**
 * Tests de integración para Auth - registro y seguridad.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Anti-regresión: asegurar que NUNCA se pueda crear admin desde registro público.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";

const API = "/api";

describe("Auth - register security (anti-regression)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("POST /api/users/register ignora role='admin' y crea worker", async () => {
    const res = await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "Hacker",
        lastName: "Admin",
        email: `hacker-${Date.now()}@test.com`,
        password: "123456",
        role: "admin",
      })
      .expect(201);

    expect(res.body.role).toBe("worker");
  });

  it("POST /api/users/register ignora cualquier role enviado", async () => {
    const res = await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "Weird",
        lastName: "Role",
        email: `weird-${Date.now()}@test.com`,
        password: "123456",
        role: "superadmin",
      })
      .expect(201);

    expect(res.body.role).toBe("worker");
  });

  it("POST /api/users/register sin role crea worker correctamente", async () => {
    const res = await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "Normal",
        lastName: "User",
        email: `normal-${Date.now()}@test.com`,
        password: "123456",
      })
      .expect(201);

    expect(res.body.role).toBe("worker");
  });

  it("POST /api/users/register persiste role=worker en BD", async () => {
    const email = `db-check-${Date.now()}@test.com`;
    await request(app)
      .post(`${API}/users/register`)
      .send({
        name: "DbCheck",
        lastName: "User",
        email,
        password: "123456",
        role: "admin",
      })
      .expect(201);

    const user = await User.findOne({ email }).lean();
    expect(user).not.toBeNull();
    expect(user?.role).toBe("worker");
  });
});
