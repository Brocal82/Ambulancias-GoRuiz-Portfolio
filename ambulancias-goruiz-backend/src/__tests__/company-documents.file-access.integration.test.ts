/**
 * GET /api/files/:filename — worker access to CompanyDocument via DocumentDelivery.
 */
import request from "supertest";
import jwt from "jsonwebtoken";
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
  removeTestUploadFile,
  uniqueUploadBasename,
  writeTestUploadFile,
} from "./test-helpers";

const API = "/api";

function issueTestJwt(userId: string, role: string, companyId?: string): string {
  const payload: Record<string, unknown> = { userId, role };
  if (companyId) payload.companyId = companyId;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("CompanyDocument file access — worker + DocumentDelivery (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("worker with valid delivery receives 200 for GET /api/files/:filename", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 1);
    const basename = uniqueUploadBasename("delivered");
    await writeTestUploadFile(basename, "pdf-bytes");

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "test.pdf",
      filename: basename,
      mimeType: "application/pdf",
      fileUrl: `/uploads/${basename}`,
      deletedAt: null,
    });

    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: worker._id,
      sentAt: new Date(),
      readAt: null,
    });

    const token = issueTestJwt(String(worker._id), "worker", companyId);
    const res = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await removeTestUploadFile(basename);
    await User.deleteMany({
      _id: { $in: [worker._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("worker without delivery receives 403", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 11);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 12);
    const basename = uniqueUploadBasename("no-delivery");
    await writeTestUploadFile(basename, "x");

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "only-w1.pdf",
      filename: basename,
      mimeType: "application/pdf",
      fileUrl: `/uploads/${basename}`,
      deletedAt: null,
    });

    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: null,
    });

    const token2 = issueTestJwt(String(w2._id), "worker", companyId);
    const res = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(403);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await removeTestUploadFile(basename);
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("worker from another company receives 403", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(dataA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(dataB.companyId);
    const adminAOid = new mongoose.Types.ObjectId(dataA.adminId);
    const workerA = await createTestWorkerInCompany(companyAOid, Date.now() + 21);
    const workerB = await createTestWorkerInCompany(companyBOid, Date.now() + 22);
    const basename = uniqueUploadBasename("cross-co");
    await writeTestUploadFile(basename, "y");

    const doc = await CompanyDocument.create({
      companyId: companyAOid,
      uploadedBy: adminAOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "company-a.pdf",
      filename: basename,
      mimeType: "application/pdf",
      fileUrl: `/uploads/${basename}`,
      deletedAt: null,
    });

    await DocumentDelivery.create({
      companyId: companyAOid,
      documentId: doc._id,
      workerId: workerA._id,
      sentAt: new Date(),
      readAt: null,
    });

    const tokenB = issueTestJwt(String(workerB._id), "worker", dataB.companyId);
    const res = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(403);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await removeTestUploadFile(basename);
    await User.deleteMany({
      _id: {
        $in: [
          workerA._id,
          workerB._id,
          adminAOid,
          new mongoose.Types.ObjectId(dataB.adminId),
        ],
      },
    });
    await Company.deleteMany({ _id: { $in: [companyAOid, companyBOid] } });
  });

  it("soft-deleted CompanyDocument is denied (403) even with delivery", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 31);
    const basename = uniqueUploadBasename("deleted-doc");
    await writeTestUploadFile(basename, "z");

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "gone.pdf",
      filename: basename,
      mimeType: "application/pdf",
      fileUrl: `/uploads/${basename}`,
      deletedAt: new Date(),
    });

    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: worker._id,
      sentAt: new Date(),
      readAt: null,
    });

    const token = issueTestJwt(String(worker._id), "worker", companyId);
    const res = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await removeTestUploadFile(basename);
    await User.deleteMany({
      _id: { $in: [worker._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });
});
