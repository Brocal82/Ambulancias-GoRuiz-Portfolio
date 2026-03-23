/**
 * Tests de integración para Messages - IDOR fix (mark as read / remove).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Anti-regresión: solo recipient puede modificar su mensaje.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestUsers, createTestWorkerUser } from "./test-helpers";
import { Message } from "../modules/messages/models/message.model";

const API = "/api";

describe("Messages - IDOR fix (read/remove)", () => {
  let adminToken: string;
  let workerAToken: string;
  let workerBToken: string;
  let adminId: string;
  let workerAId: string;
  let workerBId: string;
  let messageId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const { adminId: aid, workerId: waId, adminToken: aTok, workerToken: waTok } =
      await createTestUsers();
    adminId = aid;
    workerAId = waId;
    adminToken = aTok;
    workerAToken = waTok;

    const workerBUser = await createTestWorkerUser(`worker-b-${Date.now()}@example.com`);
    const workerBRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerBUser.email, password: "password123" });
    workerBToken = workerBRes.body.token;
    workerBId = workerBRes.body.user?._id ?? "";

    const message = await Message.create({
      subject: "Test message",
      body: "Body for IDOR test",
      sender: new mongoose.Types.ObjectId(adminId),
      recipients: [new mongoose.Types.ObjectId(workerAId)],
      toAllWorkers: false,
    });
    messageId = String(message._id);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("PATCH /messages/:id/read sin token → 401", async () => {
    await request(app)
      .patch(`${API}/messages/${messageId}/read`)
      .expect(401);
  });

  it("recipient puede marcar como leído → 200", async () => {
    const res = await request(app)
      .patch(`${API}/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("usuario NO recipient → 403 en mark as read", async () => {
    const res = await request(app)
      .patch(`${API}/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${workerBToken}`)
      .expect(403);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("No autorizado");
  });

  // TODO: Si la ruta permite admin en el futuro, descomentar y verificar:
  // it("admin puede marcar como leído → 200", async () => {
  //   await request(app)
  //     .patch(`${API}/messages/${messageId}/read`)
  //     .set("Authorization", `Bearer ${adminToken}`)
  //     .expect(200);
  // });

  it("usuario NO recipient → 403 en delete", async () => {
    const res = await request(app)
      .patch(`${API}/messages/${messageId}/remove`)
      .set("Authorization", `Bearer ${workerBToken}`)
      .expect(403);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("No autorizado");
  });

  it("recipient puede eliminar su mensaje → 200", async () => {
    const res = await request(app)
      .patch(`${API}/messages/${messageId}/remove`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .expect(200);
    expect(res.body.message).toContain("leído/borrado");
  });

  it("PATCH /messages/:id/read con id inexistente → 404", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`${API}/messages/${fakeId}/read`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .expect(404);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("Mensaje no encontrado");
  });
});
