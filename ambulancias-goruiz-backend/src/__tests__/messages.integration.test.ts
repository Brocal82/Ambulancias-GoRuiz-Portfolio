/**
 * Tests de integración para Messages.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  getTestUploadsDir,
  issueTestJwt,
  uniqueUploadBasename,
} from "./test-helpers";
import { Message } from "../modules/messages/models/message.model";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import {
  MODULE_KEYS,
  V1_DEFAULT_MODULES,
} from "../modules/companies/constants/modules.constants";
import { MESSAGE_SUBJECT_MAX_LENGTH } from "../modules/messages/constants/message-limits";
import { MESSAGE_NO_VALID_RECIPIENTS_ERROR } from "../modules/messages/services/messages.service";

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

describe("Messages - hardening (send, cleanup, module)", () => {
  let adminToken: string;
  let workerToken: string;
  let adminId: string;
  let companyId: string;
  let workerId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }

    const data = await createTestAdminWithCompany();
    adminId = data.adminId;
    companyId = data.companyId;
    adminToken = data.adminToken;

    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
      Date.now() + 100,
    );
    workerId = String(worker._id);

    const login = await request(app)
      .post(`${API}/users/login`)
      .send({ email: worker.email, password: "password123" });
    expect(login.status).toBe(200);
    workerToken = login.body.token as string;
  }, 60_000);

  afterAll(async () => {
    await User.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(workerId),
          new mongoose.Types.ObjectId(adminId),
        ],
      },
    });
    await Company.deleteOne({ _id: companyId });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it("POST /messages como worker → 403 (solo admin)", async () => {
    const res = await request(app)
      .post(`${API}/messages`)
      .set("Authorization", `Bearer ${workerToken}`)
      .field("subject", "Test")
      .field("body", "Body")
      .field("recipients", JSON.stringify([workerId]));
    expect(res.status).toBe(403);
  });

  it("rechaza destinatarios de otra empresa (inyección cross-company) → 400", async () => {
    const other = await createTestAdminWithCompany();
    const foreignWorker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(other.companyId),
      Date.now() + 200,
    );

    try {
      const res = await request(app)
        .post(`${API}/messages`)
        .set("Authorization", `Bearer ${adminToken}`)
        .field("subject", "Cross-company")
        .field("body", "Body")
        .field("toAllWorkers", "false")
        .field("recipients", JSON.stringify([String(foreignWorker._id)]));

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MESSAGE_NO_VALID_RECIPIENTS_ERROR);
    } finally {
      await User.deleteMany({
        _id: {
          $in: [
            foreignWorker._id,
            new mongoose.Types.ObjectId(other.adminId),
          ],
        },
      });
      await Company.deleteOne({ _id: other.companyId });
    }
  });

  it("limpia adjunto si falla validación Zod (subject demasiado largo)", async () => {
    const uploadsDir = getTestUploadsDir();
    const before = new Set(fs.readdirSync(uploadsDir));

    const longSubject = "x".repeat(MESSAGE_SUBJECT_MAX_LENGTH + 1);
    const res = await request(app)
      .post(`${API}/messages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("subject", longSubject)
      .field("body", "Body ok")
      .field("recipients", JSON.stringify([workerId]))
      .attach("attachment", Buffer.from("%PDF-1.4"), {
        filename: "fail-validation.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);

    const after = fs.readdirSync(uploadsDir);
    const added = after.filter((f) => !before.has(f));
    expect(added.length).toBe(0);
  });

  it("elimina fichero adjunto al borrar mensaje (admin hard delete)", async () => {
    const basename = uniqueUploadBasename("msg-del");
    const storedPath = `/uploads/${basename}`;
    const fullPath = path.join(getTestUploadsDir(), basename);
    await fs.promises.writeFile(fullPath, "%PDF-1.4", "utf8");

    const msg = await Message.create({
      subject: "Delete attachments",
      body: "Body",
      sender: new mongoose.Types.ObjectId(adminId),
      recipients: [new mongoose.Types.ObjectId(workerId)],
      toAllWorkers: false,
      companyId: new mongoose.Types.ObjectId(companyId),
      attachments: [
        {
          originalName: "del.pdf",
          filename: basename,
          mimetype: "application/pdf",
          size: 8,
          url: storedPath,
        },
      ],
    });

    const res = await request(app)
      .delete(`${API}/messages/${String(msg._id)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it("GET /messages con módulo deshabilitado → 403", async () => {
    const suffix = Date.now() + 500;
    const modulesWithoutMessages = V1_DEFAULT_MODULES.filter(
      (m) => m !== MODULE_KEYS.MESSAGES,
    );
    const company = await Company.create({
      name: `No messages ${suffix}`,
      emailDomain: "@example.com",
      isActive: true,
      enabledModules: modulesWithoutMessages,
    });
    const hashed = await bcrypt.hash("password123", 10);
    const adminUser = await User.create({
      name: "Admin",
      lastName: "NoMsg",
      email: `admin-nomsg-${suffix}@example.com`,
      password: hashed,
      role: "admin",
      companyId: company._id,
    });
    const token = issueTestJwt(String(adminUser._id), "admin", String(company._id));

    try {
      const res = await request(app)
        .get(`${API}/messages/sent`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(String(res.body.message)).toContain(MODULE_KEYS.MESSAGES);
    } finally {
      await User.deleteOne({ _id: adminUser._id });
      await Company.deleteOne({ _id: company._id });
    }
  });
});
