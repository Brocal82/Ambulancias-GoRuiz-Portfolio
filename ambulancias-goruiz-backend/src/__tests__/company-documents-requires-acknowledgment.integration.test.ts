/**
 * CompanyDocument.requiresAcknowledgment — upload + worker list alignment.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import { CompanyDocument } from "../modules/documents/models/document.model";
import { DocumentDelivery } from "../modules/documents/models/document-delivery.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
  removeTestUploadFile,
} from "./test-helpers";

const API = "/api/documents";

describe("Company documents — requiresAcknowledgment (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("POST /upload con requiresAcknowledgment=true persiste en BD y en la respuesta", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 501);
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const res = await request(app)
      .post(`${API}/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("requiresAcknowledgment", "true")
      .attach("file", Buffer.from("%PDF-1.4 req-ack"), {
        filename: "req-ack-upload.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresAcknowledgment).toBe(true);
    const stored = await CompanyDocument.findById(res.body.id).lean();
    expect(stored?.requiresAcknowledgment).toBe(true);

    const filename = res.body.filename as string;
    await DocumentDelivery.deleteMany({ documentId: res.body.id });
    await CompanyDocument.deleteOne({ _id: res.body.id });
    await removeTestUploadFile(filename);
    await User.deleteMany({
      _id: { $in: [worker._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("POST /upload sin requiresAcknowledgment queda en false", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 502);
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const res = await request(app)
      .post(`${API}/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("%PDF-1.4 no-flag"), {
        filename: "no-flag-upload.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresAcknowledgment).toBe(false);
    const stored = await CompanyDocument.findById(res.body.id).lean();
    expect(stored?.requiresAcknowledgment).not.toBe(true);

    const filename = res.body.filename as string;
    await DocumentDelivery.deleteMany({ documentId: res.body.id });
    await CompanyDocument.deleteOne({ _id: res.body.id });
    await removeTestUploadFile(filename);
    await User.deleteMany({
      _id: { $in: [worker._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("POST /upload/batch con 2 archivos deja requiresAcknowledgment=false aunque se envíe true", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 503);
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const res = await request(app)
      .post(`${API}/upload/batch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("requiresAcknowledgment", "true")
      .attach("files", Buffer.from("%PDF-1.4 a"), {
        filename: "batch-a.pdf",
        contentType: "application/pdf",
      })
      .attach("files", Buffer.from("%PDF-1.4 b"), {
        filename: "batch-b.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.documents).toHaveLength(2);
    for (const d of res.body.documents as { id: string; requiresAcknowledgment?: boolean }[]) {
      expect(d.requiresAcknowledgment).toBe(false);
      const stored = await CompanyDocument.findById(d.id).lean();
      expect(stored?.requiresAcknowledgment).not.toBe(true);
    }

    const ids = (res.body.documents as { id: string }[]).map((d) => d.id);
    await DocumentDelivery.deleteMany({
      documentId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    });
    await CompanyDocument.deleteMany({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } });
    for (const d of res.body.documents as { filename: string }[]) {
      await removeTestUploadFile(d.filename);
    }
    await User.deleteMany({
      _id: { $in: [worker._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("POST /upload/batch con 1 archivo y requiresAcknowledgment=true persiste true", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 505);
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const res = await request(app)
      .post(`${API}/upload/batch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("requiresAcknowledgment", "true")
      .attach("files", Buffer.from("%PDF-1.4 one-batch"), {
        filename: "one-in-batch.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].requiresAcknowledgment).toBe(true);
    const stored = await CompanyDocument.findById(res.body.documents[0].id).lean();
    expect(stored?.requiresAcknowledgment).toBe(true);

    const filename = res.body.documents[0].filename as string;
    const docId = res.body.documents[0].id as string;
    await DocumentDelivery.deleteMany({ documentId: docId });
    await CompanyDocument.deleteOne({ _id: docId });
    await removeTestUploadFile(filename);
    await User.deleteMany({
      _id: { $in: [worker._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("GET /documents/mine incluye requiresAcknowledgment alineado con el documento", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 504);
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const up = await request(app)
      .post(`${API}/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("requiresAcknowledgment", "true")
      .attach("file", Buffer.from("%PDF-1.4 mine"), {
        filename: "mine-flag.pdf",
        contentType: "application/pdf",
      });
    expect(up.status).toBe(201);
    const docId = up.body.id as string;
    const filename = up.body.filename as string;

    const workerToken = issueTestJwt(String(w1._id), "worker", companyId);
    const mine = await request(app)
      .get(`${API}/mine`)
      .set("Authorization", `Bearer ${workerToken}`);

    expect(mine.status).toBe(200);
    expect(mine.body.deliveries).toHaveLength(1);
    expect(mine.body.deliveries[0].requiresAcknowledgment).toBe(true);
    expect(mine.body.deliveries[0].documentId).toBe(docId);

    await DocumentDelivery.deleteMany({ documentId: docId });
    await CompanyDocument.deleteOne({ _id: docId });
    await removeTestUploadFile(filename);
    await User.deleteMany({ _id: { $in: [w1._id, new mongoose.Types.ObjectId(adminId)] } });
    await Company.deleteOne({ _id: companyOid });
  });
});
