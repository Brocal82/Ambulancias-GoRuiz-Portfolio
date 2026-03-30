/**
 * Acceso a adjuntos de mensajes vía GET /api/files/:filename (canAccessFile, rama Message).
 * Fixtures en BD + fichero en disco; sin multipart.
 */
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import { Message } from "../modules/messages/models/message.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  uniqueUploadBasename,
  writeTestUploadFile,
  removeTestUploadFile,
} from "./test-helpers";

const API = "/api";

function issueTestJwt(userId: string, role: string, companyId?: string): string {
  const payload: Record<string, unknown> = { userId, role };
  if (companyId) payload.companyId = companyId;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("Message attachment file access (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("fixture: one company, message with single recipient", () => {
    let attachBasename: string;
    let companyBId: string;
    let adminBId: string;
    let workerRecipientId: string;
    let workerOtherId: string;
    let messageId: string;

    beforeAll(async () => {
      const dataB = await createTestAdminWithCompany();
      companyBId = dataB.companyId;
      adminBId = dataB.adminId;

      const workerRecipient = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyBId),
        Date.now(),
      );
      const workerOther = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyBId),
        Date.now() + 1,
      );
      workerRecipientId = String(workerRecipient._id);
      workerOtherId = String(workerOther._id);

      attachBasename = uniqueUploadBasename("msg-attach");
      const storedPath = `/uploads/${attachBasename}`;
      await writeTestUploadFile(attachBasename, "pdf-bytes");

      const msg = await Message.create({
        subject: "Attachment test",
        body: "Body",
        sender: new mongoose.Types.ObjectId(adminBId),
        recipients: [workerRecipient._id],
        toAllWorkers: false,
        companyId: new mongoose.Types.ObjectId(companyBId),
        attachments: [
          {
            originalName: "notice.pdf",
            filename: attachBasename,
            mimetype: "application/pdf",
            size: 9,
            url: storedPath,
          },
        ],
      });
      messageId = String(msg._id);
    });

    afterAll(async () => {
      await Message.deleteOne({ _id: messageId });
      await removeTestUploadFile(attachBasename);
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerRecipientId),
            new mongoose.Types.ObjectId(workerOtherId),
            new mongoose.Types.ObjectId(adminBId),
          ],
        },
      });
      await Company.deleteOne({ _id: companyBId });
    });

    it("allows recipient to download attachment via /api/files/:filename => 200", async () => {
      const token = issueTestJwt(workerRecipientId, "worker", companyBId);
      const res = await request(app)
        .get(`${API}/files/${attachBasename}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it("allows sender admin to download same attachment => 200", async () => {
      const token = issueTestJwt(adminBId, "admin", companyBId);
      const res = await request(app)
        .get(`${API}/files/${attachBasename}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it("denies same-tenant worker who is not sender or recipient => 403", async () => {
      const token = issueTestJwt(workerOtherId, "worker", companyBId);
      const res = await request(app)
        .get(`${API}/files/${attachBasename}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  it("denies worker from company A when message only involves company B => 403", async () => {
    const [dataA, dataB] = await Promise.all([
      createTestAdminWithCompany(),
      createTestAdminWithCompany(),
    ]);
    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 10,
    );
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataB.companyId),
      Date.now() + 11,
    );
    const basename = uniqueUploadBasename("msg-cross");
    const storedPath = `/uploads/${basename}`;
    await writeTestUploadFile(basename, "x");
    const crossMsg = await Message.create({
      subject: "B only",
      body: "Body",
      sender: new mongoose.Types.ObjectId(dataB.adminId),
      recipients: [workerB._id],
      toAllWorkers: false,
      companyId: new mongoose.Types.ObjectId(dataB.companyId),
      attachments: [
        {
          originalName: "f.pdf",
          filename: basename,
          mimetype: "application/pdf",
          size: 1,
          url: storedPath,
        },
      ],
    });
    try {
      const tokenA = issueTestJwt(String(workerA._id), "worker", dataA.companyId);
      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
    } finally {
      await Message.deleteOne({ _id: crossMsg._id });
      await removeTestUploadFile(basename);
      await User.deleteMany({
        _id: {
          $in: [
            workerA._id,
            workerB._id,
            new mongoose.Types.ObjectId(dataA.adminId),
            new mongoose.Types.ObjectId(dataB.adminId),
          ],
        },
      });
      await Company.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(dataA.companyId),
            new mongoose.Types.ObjectId(dataB.companyId),
          ],
        },
      });
    }
  });
});
