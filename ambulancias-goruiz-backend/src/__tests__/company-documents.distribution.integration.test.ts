/**
 * Distribución de CompanyDocument → DocumentDelivery (targetWorkerId vs todos).
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

const API = "/api";

describe("Company documents — delivery distribution (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("sin targetWorkerId crea entregas para todos los trabajadores activos", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 1);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 2);

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("targetWorkerId", "")
      .attach("file", Buffer.from("%PDF-1.4 all-workers"), {
        filename: "all-workers.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    const docId = new mongoose.Types.ObjectId(res.body.id);
    const filename = res.body.filename as string;

    const count = await DocumentDelivery.countDocuments({ documentId: docId });
    expect(count).toBe(2);

    const workerIds = [w1._id, w2._id].map((id) => String(id));
    for (const wid of workerIds) {
      const d = await DocumentDelivery.findOne({
        documentId: docId,
        workerId: wid,
        companyId: companyOid,
      }).lean();
      expect(d).toBeTruthy();
    }

    await DocumentDelivery.deleteMany({ documentId: docId });
    await CompanyDocument.deleteOne({ _id: docId });
    await removeTestUploadFile(filename);
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("con targetWorkerId válido crea una sola entrega para ese trabajador", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 11);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 12);

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("targetWorkerId", String(w1._id))
      .attach("file", Buffer.from("%PDF-1.4 targeted"), {
        filename: "targeted.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(String(res.body.targetWorkerId)).toBe(String(w1._id));

    const docId = new mongoose.Types.ObjectId(res.body.id);
    const filename = res.body.filename as string;

    const count = await DocumentDelivery.countDocuments({ documentId: docId });
    expect(count).toBe(1);

    const only = await DocumentDelivery.findOne({ documentId: docId }).lean();
    expect(String(only?.workerId)).toBe(String(w1._id));

    const other = await DocumentDelivery.findOne({
      documentId: docId,
      workerId: w2._id,
    }).lean();
    expect(other).toBeNull();

    await DocumentDelivery.deleteMany({ documentId: docId });
    await CompanyDocument.deleteOne({ _id: docId });
    await removeTestUploadFile(filename);
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("rechaza targetWorkerId de otra empresa (400) y no crea documento", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();
    const tokenA = issueTestJwt(dataA.adminId, "admin", dataA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(dataB.companyId);
    const workerB = await createTestWorkerInCompany(companyBOid, Date.now() + 21);

    const before = await CompanyDocument.countDocuments({
      companyId: new mongoose.Types.ObjectId(dataA.companyId),
    });

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${tokenA}`)
      .field("targetWorkerId", String(workerB._id))
      .attach("file", Buffer.from("%PDF-1.4 cross"), {
        filename: "cross-company.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();

    const after = await CompanyDocument.countDocuments({
      companyId: new mongoose.Types.ObjectId(dataA.companyId),
    });
    expect(after).toBe(before);

    await User.deleteMany({
      _id: {
        $in: [
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
  });

  it("rechaza trabajador inactivo como destinatario", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const wInactive = await createTestWorkerInCompany(companyOid, Date.now() + 31);
    await User.updateOne({ _id: wInactive._id }, { $set: { isActive: false } });

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("targetWorkerId", String(wInactive._id))
      .attach("file", Buffer.from("%PDF-1.4 inactive"), {
        filename: "inactive-target.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);

    await User.deleteMany({
      _id: { $in: [wInactive._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("rechaza admin como destinatario (no es role worker)", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);

    const res = await request(app)
      .post(`${API}/documents/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("targetWorkerId", adminId)
      .attach("file", Buffer.from("%PDF-1.4 admin-target"), {
        filename: "admin-target.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: companyOid });
  });

  it("lote sin targetWorkerId sigue creando entregas para todos los activos", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 41);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 42);

    const res = await request(app)
      .post(`${API}/documents/upload/batch`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("files", Buffer.from("%PDF-1.4 batch-a"), {
        filename: "batch-a.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    const firstId = res.body.documents[0].id;
    const docId = new mongoose.Types.ObjectId(firstId);
    const filename = res.body.documents[0].filename as string;

    expect(await DocumentDelivery.countDocuments({ documentId: docId })).toBe(2);

    await DocumentDelivery.deleteMany({ documentId: docId });
    await CompanyDocument.deleteOne({ _id: docId });
    await removeTestUploadFile(filename);
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });
});
