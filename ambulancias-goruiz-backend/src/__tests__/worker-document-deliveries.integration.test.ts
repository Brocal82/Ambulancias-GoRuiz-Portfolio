/**
 * Worker: GET /api/documents/mine, PATCH .../read, POST .../acknowledge
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

/** Contraseña por defecto de `createTestWorkerInCompany` en test-helpers. */
const WORKER_PASSWORD = "password123";

describe("worker-document-deliveries (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

describe("Worker document deliveries API (integration)", () => {
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
      requiresAcknowledgment: false,
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
    expect(res1.body.deliveries[0].requiresAcknowledgment).toBe(false);

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

describe("POST /api/documents/deliveries/:deliveryId/acknowledge (integration)", () => {
  it("worker confirma recepción con contraseña correcta (lectura previa)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 101);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "ack.pdf",
      filename: `ack-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/ack-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const url = `${API}/deliveries/${String(del._id)}/acknowledge`;

    const res = await request(app)
      .post(url)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: WORKER_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.deliveryId).toBe(String(del._id));
    expect(res.body.readAt).toBeTruthy();
    expect(res.body.acknowledgedAt).toBeTruthy();

    const row = await DocumentDelivery.findById(del._id).lean();
    expect((row as { acknowledgedAt?: Date }).acknowledgedAt).toBeTruthy();

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("segunda confirmación es idempotente (200, mismo acknowledgedAt)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 111);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "ack2.pdf",
      filename: `ack2-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/ack2-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const url = `${API}/deliveries/${String(del._id)}/acknowledge`;

    const r1 = await request(app)
      .post(url)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: WORKER_PASSWORD });
    expect(r1.status).toBe(200);
    const ack1 = r1.body.acknowledgedAt;

    const r2 = await request(app)
      .post(url)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: WORKER_PASSWORD });
    expect(r2.status).toBe(200);
    expect(new Date(r2.body.acknowledgedAt).getTime()).toBe(
      new Date(ack1).getTime(),
    );

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("rechaza confirmación si readAt es null (409)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 121);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "noread.pdf",
      filename: `nr-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/nr-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
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
    const res = await request(app)
      .post(`${API}/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: WORKER_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.message).toBeTruthy();

    const row = await DocumentDelivery.findById(del._id).lean();
    expect((row as { acknowledgedAt?: Date | null }).acknowledgedAt ?? null).toBeNull();

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("contraseña incorrecta no confirma (401)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 131);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "badpwd.pdf",
      filename: `bp-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/bp-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const res = await request(app)
      .post(`${API}/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: "wrong-password-xyz" });

    expect(res.status).toBe(401);

    const row = await DocumentDelivery.findById(del._id).lean();
    expect((row as { acknowledgedAt?: Date | null }).acknowledgedAt ?? null).toBeNull();

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("otro trabajador no puede confirmar la entrega (404)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 141);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 142);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "otherw.pdf",
      filename: `ow-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/ow-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const t2 = issueTestJwt(String(w2._id), "worker", companyId);
    const res = await request(app)
      .post(`${API}/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${t2}`)
      .send({ password: WORKER_PASSWORD });

    expect(res.status).toBe(404);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("trabajador de otra empresa no puede confirmar (404)", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(dataA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(dataB.companyId);
    const adminAOid = new mongoose.Types.ObjectId(dataA.adminId);
    const wA = await createTestWorkerInCompany(companyAOid, Date.now() + 151);
    const wB = await createTestWorkerInCompany(companyBOid, Date.now() + 152);

    const doc = await CompanyDocument.create({
      companyId: companyAOid,
      uploadedBy: adminAOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "cross-ack.pdf",
      filename: `ca-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/ca-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyAOid,
      documentId: doc._id,
      workerId: wA._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const tB = issueTestJwt(String(wB._id), "worker", dataB.companyId);
    const res = await request(app)
      .post(`${API}/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${tB}`)
      .send({ password: WORKER_PASSWORD });

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

  it("documento soft-deleted no se puede confirmar (404)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 161);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "soft.pdf",
      filename: `sd-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/sd-${Date.now()}.pdf`,
      requiresAcknowledgment: true,
      deletedAt: new Date(),
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const res = await request(app)
      .post(`${API}/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: WORKER_PASSWORD });

    expect(res.status).toBe(404);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("rechaza confirmación si el documento no requiere confirmación (400)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 171);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "no-req-ack.pdf",
      filename: `nra-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/nra-${Date.now()}.pdf`,
      requiresAcknowledgment: false,
      deletedAt: null,
    });

    const del = await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const t1 = issueTestJwt(String(w1._id), "worker", companyId);
    const res = await request(app)
      .post(`${API}/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${t1}`)
      .send({ password: WORKER_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("no requiere confirmación");

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [w1._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });
});

}); // worker-document-deliveries (integration)
