/**
 * Tests de integración para Messages - IDOR fix (mark as read / remove).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Anti-regresión: solo recipient puede modificar su mensaje.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany, createTestWorkerInCompany } from "./test-helpers";
import { Message } from "../modules/messages/models/message.model";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";

const API = "/api";

describe("Messages - IDOR fix (read/remove)", () => {
  let adminToken: string;
  let workerAToken: string;
  let workerBToken: string;
  let adminId: string;
  let companyId: string;
  let workerAId: string;
  let workerBId: string;
  let messageId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const data = await createTestAdminWithCompany();
    adminId = data.adminId;
    companyId = data.companyId;
    adminToken = data.adminToken;

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
      Date.now(),
    );
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
      Date.now() + 1,
    );
    workerAId = String(workerA._id);
    workerBId = String(workerB._id);

    const loginA = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerA.email, password: "password123" });
    const loginB = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerB.email, password: "password123" });
    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);
    workerAToken = loginA.body.token as string;
    workerBToken = loginB.body.token as string;

    const message = await Message.create({
      subject: "Test message",
      body: "Body for IDOR test",
      sender: new mongoose.Types.ObjectId(adminId),
      recipients: [new mongoose.Types.ObjectId(workerAId)],
      toAllWorkers: false,
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    messageId = String(message._id);
  }, 60_000);

  afterAll(async () => {
    await Message.deleteOne({ _id: messageId });
    await User.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(workerAId),
          new mongoose.Types.ObjectId(workerBId),
          new mongoose.Types.ObjectId(adminId),
        ],
      },
    });
    await Company.deleteOne({ _id: companyId });
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
