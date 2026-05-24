/**
 * Upload hardening: PDF-only, cleanup on validation failure, module gate.
 */
import fs from "fs/promises";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import { CompanyDocument } from "../modules/documents/models/document.model";
import { DocumentDelivery } from "../modules/documents/models/document-delivery.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  getTestUploadsDir,
  issueTestJwt,
  listNewUploadFiles,
  removeTestUploadFile,
} from "./test-helpers";

const API = "/api";

describe("Company documents — upload hardening (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  async function uploadsBefore(): Promise<Set<string>> {
    const dir = getTestUploadsDir();
    return new Set(await fs.readdir(dir).catch(() => []));
  }

  it("rechaza imágenes JPEG en upload (400) — solo PDF", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("fake-jpeg"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/PDF/i);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  });

  it("rechaza PDF con extensión no PDF (MIME mismatch)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const before = await uploadsBefore();

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("%PDF-1.4 mismatch"), {
        filename: "bad.txt",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    const orphans = await listNewUploadFiles(before);
    expect(orphans).toHaveLength(0);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  });

  it("limpia fichero tras targetWorkerId inválido (trabajador inactivo)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const wInactive = await createTestWorkerInCompany(companyOid, Date.now() + 501);
    await User.updateOne({ _id: wInactive._id }, { $set: { isActive: false } });
    const before = await uploadsBefore();

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("targetWorkerId", String(wInactive._id))
      .attach("file", Buffer.from("%PDF-1.4 inactive-cleanup"), {
        filename: "inactive-cleanup.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    const orphans = await listNewUploadFiles(before);
    expect(orphans).toHaveLength(0);

    await User.deleteMany({
      _id: { $in: [wInactive._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("limpia fichero tras rechazar admin como destinatario", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const before = await uploadsBefore();

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("targetWorkerId", adminId)
      .attach("file", Buffer.from("%PDF-1.4 admin-cleanup"), {
        filename: "admin-cleanup.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    const orphans = await listNewUploadFiles(before);
    expect(orphans).toHaveLength(0);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  });

  it("rechaza requiresAcknowledgment en lote multi-archivo y limpia ficheros", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const before = await uploadsBefore();

    const res = await request(app)
      .post(`${API}/documents/upload/batch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("requiresAcknowledgment", "true")
      .attach("files", Buffer.from("%PDF-1.4 a"), {
        filename: "a.pdf",
        contentType: "application/pdf",
      })
      .attach("files", Buffer.from("%PDF-1.4 b"), {
        filename: "b.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    const orphans = await listNewUploadFiles(before);
    expect(orphans).toHaveLength(0);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  });

  it("GET /uploads/:pdf devuelve 403 (PDF no público)", async () => {
    const res = await request(app).get("/uploads/company-doc-unit-test.pdf");
    expect(res.status).toBe(403);
  });

  it("worker de otra empresa recibe 403 en GET /api/files/:filename", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(dataA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(dataB.companyId);
    const adminAOid = new mongoose.Types.ObjectId(dataA.adminId);
    const workerA = await createTestWorkerInCompany(companyAOid, Date.now() + 601);
    const workerB = await createTestWorkerInCompany(companyBOid, Date.now() + 602);
    const basename = `iso-${Date.now()}.pdf`;
    const uploadsPath = `${getTestUploadsDir()}/${basename}`;
    await fs.writeFile(uploadsPath, "bytes", "utf8");

    const doc = await CompanyDocument.create({
      companyId: companyAOid,
      uploadedBy: adminAOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "iso.pdf",
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

  it("documento soft-deleted deniega GET /api/files aunque exista entrega", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 701);
    const basename = `deleted-${Date.now()}.pdf`;
    await fs.writeFile(`${getTestUploadsDir()}/${basename}`, "z", "utf8");

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
    await User.deleteMany({ _id: { $in: [worker._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("acknowledge rechaza contraseña vacía (400)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 801);

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
      workerId: worker._id,
      sentAt: new Date(),
      readAt: new Date(),
    });

    const token = issueTestJwt(String(worker._id), "worker", companyId);
    const res = await request(app)
      .post(`${API}/documents/deliveries/${String(del._id)}/acknowledge`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "   " });

    expect(res.status).toBe(400);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({ _id: { $in: [worker._id, adminOid] } });
    await Company.deleteOne({ _id: companyOid });
  });

  it("403 cuando módulo documents está deshabilitado", async () => {
    const { companyId, adminId, company } = await createTestAdminWithCompany();
    await Company.updateOne(
      { _id: company._id },
      {
        $set: {
          enabledModules: (company.enabledModules ?? []).filter(
            (m) => m !== MODULE_KEYS.DOCUMENTS,
          ),
        },
      },
    );
    const adminToken = issueTestJwt(adminId, "admin", companyId);

    const res = await request(app)
      .get(`${API}/documents`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(403);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: company._id });
  });
});
