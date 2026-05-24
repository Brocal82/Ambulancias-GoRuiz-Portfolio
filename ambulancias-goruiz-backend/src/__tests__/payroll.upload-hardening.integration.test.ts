/**
 * Payroll upload hardening, tenant isolation, and secure file access.
 */
import fs from "fs/promises";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import PayrollDocument from "../modules/payroll/models/payroll-document.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  getTestUploadsDir,
  issueTestJwt,
  listNewUploadFiles,
  removeTestUploadFile,
  uniqueUploadBasename,
  writeTestUploadFile,
} from "./test-helpers";
import { validateSecureUploadFilename } from "../utils/secureUploadFilename";

const API = "/api";

describe("Payroll — upload hardening & security (integration)", () => {
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

  it("rechaza imágenes JPEG en upload (400) — solo PDF en middleware", async () => {
    const { companyId, adminId, adminToken } = await createTestAdminWithCompany();

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("year", "2025")
      .field("month", "3")
      .attach("payroll", Buffer.from("fake-jpeg"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/PDF/i);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  });

  it("rechaza PDF con extensión no PDF (MIME mismatch) y limpia fichero", async () => {
    const { companyId, adminId, adminToken } = await createTestAdminWithCompany();
    const before = await uploadsBefore();

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("year", "2025")
      .field("month", "3")
      .attach("payroll", Buffer.from("%PDF-1.4 mismatch"), {
        filename: "bad.txt",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/MIME/i);
    const orphans = await listNewUploadFiles(before);
    expect(orphans).toHaveLength(0);

    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  });

  it("limpia fichero tras workerId de otra empresa (403)", async () => {
    const companyA = await createTestAdminWithCompany();
    const companyB = await createTestAdminWithCompany();
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyB.companyId),
      Date.now() + 701,
    );
    const before = await uploadsBefore();

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${companyA.adminToken}`)
      .field("year", "2025")
      .field("month", "4")
      .field("workerId", String(workerB._id))
      .attach("payroll", Buffer.from("%PDF-1.4 cross-company"), {
        filename: "cross-company.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(403);
    const orphans = await listNewUploadFiles(before);
    expect(orphans).toHaveLength(0);

    await User.deleteMany({
      _id: {
        $in: [
          workerB._id,
          new mongoose.Types.ObjectId(companyA.adminId),
          new mongoose.Types.ObjectId(companyB.adminId),
        ],
      },
    });
    await Company.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(companyA.companyId),
          new mongoose.Types.ObjectId(companyB.companyId),
        ],
      },
    });
  });

  it("auto-match solo dentro de la misma empresa", async () => {
    const companyA = await createTestAdminWithCompany();
    const companyB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(companyA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(companyB.companyId);

    const workerA = await createTestWorkerInCompany(companyAOid, Date.now() + 801);
    await User.updateOne({ _id: workerA._id }, { $set: { employeeNumber: "EMP9001" } });

    const workerB = await createTestWorkerInCompany(companyBOid, Date.now() + 802);
    await User.updateOne({ _id: workerB._id }, { $set: { employeeNumber: "EMP9001" } });

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${companyA.adminToken}`)
      .field("year", "2025")
      .field("month", "5")
      .attach("payroll", Buffer.from("%PDF-1.4 auto-match"), {
        filename: "nomina_EMP9001_mayo.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.matchStatus).toBe("matched");
    expect(String(res.body.workerId)).toBe(String(workerA._id));

    await PayrollDocument.deleteMany({
      companyId: { $in: [companyAOid, companyBOid] },
    });
    await User.deleteMany({
      _id: {
        $in: [
          workerA._id,
          workerB._id,
          new mongoose.Types.ObjectId(companyA.adminId),
          new mongoose.Types.ObjectId(companyB.adminId),
        ],
      },
    });
    await Company.deleteMany({ _id: { $in: [companyAOid, companyBOid] } });
  });

  it("normaliza nombre almacenado compatible con validateSecureUploadFilename", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("year", "2025")
      .field("month", "6")
      .attach("payroll", Buffer.from("%PDF-1.4 weird-name"), {
        filename: "../Nómina%2FEMP0001 (Junio).pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.filename).toBeTruthy();
    expect(validateSecureUploadFilename(res.body.filename).ok).toBe(true);

    const doc = await PayrollDocument.findById(res.body.payrollId).lean();
    if (doc?.filename) {
      await removeTestUploadFile(doc.filename);
    }
    await PayrollDocument.deleteMany({ companyId: companyOid });
    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: companyOid });
  });

  it("reemplazo invalida nómina activa anterior del mismo periodo", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 901);
    await User.updateOne({ _id: worker._id }, { $set: { employeeNumber: "EMP7777" } });

    const first = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("year", "2025")
      .field("month", "7")
      .field("workerId", String(worker._id))
      .attach("payroll", Buffer.from("%PDF-1.4 first"), {
        filename: "first.pdf",
        contentType: "application/pdf",
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("year", "2025")
      .field("month", "7")
      .field("workerId", String(worker._id))
      .attach("payroll", Buffer.from("%PDF-1.4 second"), {
        filename: "second.pdf",
        contentType: "application/pdf",
      });
    expect(second.status).toBe(201);
    expect(second.body.replacedDocument?.payrollId).toBe(String(first.body.payrollId));

    const oldDoc = await PayrollDocument.findById(first.body.payrollId).lean();
    expect(oldDoc?.deletedAt).toBeTruthy();

    const activeDocs = await PayrollDocument.find({
      companyId: companyOid,
      workerId: worker._id,
      year: 2025,
      month: 7,
      deletedAt: null,
    }).lean();
    expect(activeDocs).toHaveLength(1);
    expect(String(activeDocs[0]._id)).toBe(String(second.body.payrollId));

    const docs = await PayrollDocument.find({ companyId: companyOid }).lean();
    for (const d of docs) {
      if (d.filename) await removeTestUploadFile(d.filename);
    }
    await PayrollDocument.deleteMany({ companyId: companyOid });
    await User.deleteMany({
      _id: { $in: [worker._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("deniega acceso a nómina invalidada vía GET /api/files", async () => {
    const { companyId, adminId, adminToken } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 1001);
    const workerToken = issueTestJwt(String(worker._id), "worker", companyId);

    const basename = uniqueUploadBasename("payroll-invalidated");
    await writeTestUploadFile(basename, "%PDF-1.4 invalidated");

    const doc = await PayrollDocument.create({
      workerId: worker._id,
      companyId: companyOid,
      uploadedBy: new mongoose.Types.ObjectId(adminId),
      filename: basename,
      originalName: "invalidated.pdf",
      fileUrl: `/uploads/${basename}`,
      matchStatus: "manual",
      year: 2025,
      month: 8,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(403);

    await removeTestUploadFile(basename);
    await PayrollDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: { $in: [worker._id, new mongoose.Types.ObjectId(adminId)] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("worker accede a su nómina; admin de la empresa también; otro worker no", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const adminToken = issueTestJwt(adminId, "admin", companyId);
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 1101);
    const otherWorker = await createTestWorkerInCompany(companyOid, Date.now() + 1102);
    const workerToken = issueTestJwt(String(worker._id), "worker", companyId);
    const otherToken = issueTestJwt(String(otherWorker._id), "worker", companyId);

    const basename = uniqueUploadBasename("payroll-ownership");
    await writeTestUploadFile(basename, "%PDF-1.4 ownership");

    const doc = await PayrollDocument.create({
      workerId: worker._id,
      companyId: companyOid,
      uploadedBy: new mongoose.Types.ObjectId(adminId),
      filename: basename,
      originalName: "ownership.pdf",
      fileUrl: `/uploads/${basename}`,
      matchStatus: "manual",
      year: 2025,
      month: 9,
    });

    const ownerRes = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(ownerRes.status).toBe(200);

    const adminRes = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);

    const otherRes = await request(app)
      .get(`${API}/files/${basename}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(403);

    await removeTestUploadFile(basename);
    await PayrollDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: {
        $in: [
          worker._id,
          otherWorker._id,
          new mongoose.Types.ObjectId(adminId),
        ],
      },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("GET /payroll/mine filtra por companyId cuando el JWT lo incluye", async () => {
    const companyA = await createTestAdminWithCompany();
    const companyB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(companyA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(companyB.companyId);

    const worker = await createTestWorkerInCompany(companyAOid, Date.now() + 1201);
    const workerToken = issueTestJwt(String(worker._id), "worker", companyA.companyId);

    await PayrollDocument.create({
      workerId: worker._id,
      companyId: companyAOid,
      uploadedBy: new mongoose.Types.ObjectId(companyA.adminId),
      filename: "current-co.pdf",
      originalName: "current.pdf",
      fileUrl: "/uploads/current-co.pdf",
      matchStatus: "manual",
      year: 2025,
      month: 10,
    });

    await PayrollDocument.create({
      workerId: worker._id,
      companyId: companyBOid,
      uploadedBy: new mongoose.Types.ObjectId(companyB.adminId),
      filename: "old-co.pdf",
      originalName: "old.pdf",
      fileUrl: "/uploads/old-co.pdf",
      matchStatus: "manual",
      year: 2024,
      month: 12,
    });

    const res = await request(app)
      .get(`${API}/payroll/mine`)
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].originalName).toBe("current.pdf");

    await PayrollDocument.deleteMany({ workerId: worker._id });
    await User.deleteMany({
      _id: {
        $in: [
          worker._id,
          new mongoose.Types.ObjectId(companyA.adminId),
          new mongoose.Types.ObjectId(companyB.adminId),
        ],
      },
    });
    await Company.deleteMany({ _id: { $in: [companyAOid, companyBOid] } });
  });
});
