/**
 * Worker: GET /api/documents/mine y PATCH .../deliveries/:deliveryId/read
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
} from "./test-helpers";

const API = "/api/documents";

describe("Worker document deliveries API (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("worker lista solo sus propias entregas visibles (documento activo)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 1);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 2);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "solo-w1.pdf",
      filename: `f-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/f-${Date.now()}.pdf`,
      deletedAt: null,
    });

    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: null,
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const t2 = issueTestJwt(String(w2._id), "worker", companyId);

    const res1 = await request(app)
      .get(`${API}/mine`)
      .set("Authorization", `Bearer ${t1}`);
    expect(res1.status).toBe(200);
    expect(res1.body.deliveries).toHaveLength(1);
    expect(res1.body.deliveries[0].documentId).toBe(String(doc._id));

    const res2 = await request(app)
      .get(`${API}/mine`)
      .set("Authorization", `Bearer ${t2}`);
    expect(res2.status).toBe(200);
    expect(res2.body.deliveries).toHaveLength(0);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("no lista documentos soft-deleted aunque exista entrega", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 11);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "deleted.pdf",
      filename: `del-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/del-${Date.now()}.pdf`,
      deletedAt: new Date(),
    });

    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: null,
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const res = await request(app)
      .get(`${API}/mine`)
      .set("Authorization", `Bearer ${t1}`);

    expect(res.status).toBe(200);
    expect(res.body.deliveries).toHaveLength(0);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("worker marca lectura y segunda llamada es idempotente", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 21);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "read.pdf",
      filename: `read-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/read-${Date.now()}.pdf`,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: null,
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const url = `${API}/deliveries/${String(del._id)}/read`;

    const p1 = await request(app)
      .patch(url)
      .set("Authorization", `Bearer ${t1}`);
    expect(p1.status).toBe(200);
    expect(p1.body.readAt).toBeTruthy();

    const p2 = await request(app)
      .patch(url)
      .set("Authorization", `Bearer ${t1}`);
    expect(p2.status).toBe(200);
    expect(new Date(p2.body.readAt).getTime()).toBe(
      new Date(p1.body.readAt).getTime(),
    );

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("worker no puede marcar lectura de entrega de otro trabajador (404)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 31);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 32);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "other.pdf",
      filename: `oth-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/oth-${Date.now()}.pdf`,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: null,
    });

    const t2 = issueTestJwt(String(w2._id), "worker", companyId);
    const res = await request(app)
      .patch(`${API}/deliveries/${String(del._id)}/read`)
      .set("Authorization", `Bearer ${t2}`);

    expect(res.status).toBe(404);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("trabajador de otra empresa no puede marcar lectura (404)", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(dataA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(dataB.companyId);
    const adminAOid = new mongoose.Types.ObjectId(dataA.adminId);
    const wA = await createTestWorkerInCompany(companyAOid, Date.now() + 41);
    const wB = await createTestWorkerInCompany(companyBOid, Date.now() + 42);

    const doc = await CompanyDocument.create({
      companyId: companyAOid,
      uploadedBy: adminAOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "a.pdf",
      filename: `cross-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/cross-${Date.now()}.pdf`,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyAOid,
      documentId: doc._id,
      workerId: wA._id,
      sentAt: new Date(),
      readAt: null,
    });

    const tB = issueTestJwt(String(wB._id), "worker", dataB.companyId);
    const res = await request(app)
      .patch(`${API}/deliveries/${String(del._id)}/read`)
      .set("Authorization", `Bearer ${tB}`);

    expect(res.status).toBe(404);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: {
        $in: [
          wA._id,
          wB._id,
          adminAOid,
          new mongoose.Types.ObjectId(dataB.adminId),
        ],
      },
    });
    await Company.deleteMany({ _id: { $in: [companyAOid, companyBOid] } });
  });
});
