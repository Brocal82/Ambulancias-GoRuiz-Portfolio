/**
 * Tests de integración para Hospitals - updateHospital (PUT/PATCH).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Usa una DB real dedicada para tests (ej: ambulancias_test).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany, createTestUsers } from "./test-helpers";

const API = "/api";

describe("Hospitals - updateHospital (PUT/PATCH)", () => {
  let adminToken: string;
  let workerToken: string;
  let hospitalId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const [legacy, dataWithCompany] = await Promise.all([
      createTestUsers(),
      createTestAdminWithCompany(),
    ]);
    adminToken = dataWithCompany.adminToken;
    workerToken = legacy.workerToken;

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
    await mongoose.disconnect();
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
