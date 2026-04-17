/**
 * GET /api/documents — métricas de lectura y confirmación (DocumentDelivery).
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

describe("Admin documents list — acknowledgment metrics (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("incluye acknowledgedCount, pendingAcknowledgmentCount y readButNotAcknowledgedCount; solo acknowledgedAt cuenta como confirmado", async () => {
    const { companyId, adminId } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const adminOid = new mongoose.Types.ObjectId(adminId);
    const w1 = await createTestWorkerInCompany(companyOid, Date.now() + 1);
    const w2 = await createTestWorkerInCompany(companyOid, Date.now() + 2);
    const w3 = await createTestWorkerInCompany(companyOid, Date.now() + 3);

    const doc = await CompanyDocument.create({
      companyId: companyOid,
      uploadedBy: adminOid,
      targetWorkerId: null,
      uploadBatchId: null,
      originalName: "metrics.pdf",
      filename: `m-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/m-${Date.now()}.pdf`,
      deletedAt: null,
    });

    const now = new Date();
    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w1._id,
      sentAt: now,
      readAt: now,
      acknowledgedAt: now,
    });
    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w2._id,
      sentAt: now,
      readAt: now,
      acknowledgedAt: null,
    });
    await DocumentDelivery.create({
      companyId: companyOid,
      documentId: doc._id,
      workerId: w3._id,
      sentAt: now,
      readAt: null,
      acknowledgedAt: null,
    });

    const token = issueTestJwt(adminId, "admin", companyId);
    const res = await request(app)
      .get(API)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    type ListRow = {
      id: string;
      totalRecipients: number;
      readCount: number;
      acknowledgedCount: number;
      pendingAcknowledgmentCount: number;
      readButNotAcknowledgedCount: number;
    };
    const rows = res.body as ListRow[];
    const row = rows.find((x) => String(x.id) === String(doc._id));
    expect(row).toBeDefined();

    expect(row!.totalRecipients).toBe(3);
    expect(row!.readCount).toBe(2);
    expect(row!.acknowledgedCount).toBe(1);
    expect(row!.pendingAcknowledgmentCount).toBe(2);
    expect(row!.readButNotAcknowledgedCount).toBe(1);

    await DocumentDelivery.deleteMany({ documentId: doc._id });
    await CompanyDocument.deleteOne({ _id: doc._id });
    await User.deleteMany({
      _id: { $in: [w1._id, w2._id, w3._id, adminOid] },
    });
    await Company.deleteOne({ _id: companyOid });
  });

  it("métricas solo de la empresa del admin (sin documentos de otra empresa)", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(dataA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(dataB.companyId);
    const adminAOid = new mongoose.Types.ObjectId(dataA.adminId);
    const adminBOid = new mongoose.Types.ObjectId(dataB.adminId);
    const wA = await createTestWorkerInCompany(companyAOid, Date.now() + 11);
    const wB = await createTestWorkerInCompany(companyBOid, Date.now() + 12);

    const docA = await CompanyDocument.create({
      companyId: companyAOid,
      uploadedBy: adminAOid,
      originalName: "a-only.pdf",
      filename: `a-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/a-${Date.now()}.pdf`,
      deletedAt: null,
    });
    const docB = await CompanyDocument.create({
      companyId: companyBOid,
      uploadedBy: adminBOid,
      originalName: "b-only.pdf",
      filename: `b-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      fileUrl: `/uploads/b-${Date.now()}.pdf`,
      deletedAt: null,
    });

    const t = new Date();
    await DocumentDelivery.create({
      companyId: companyAOid,
      documentId: docA._id,
      workerId: wA._id,
      sentAt: t,
      readAt: t,
      acknowledgedAt: t,
    });
    await DocumentDelivery.create({
      companyId: companyBOid,
      documentId: docB._id,
      workerId: wB._id,
      sentAt: t,
      readAt: t,
      acknowledgedAt: t,
    });

    const tokenA = issueTestJwt(dataA.adminId, "admin", dataA.companyId);
    const res = await request(app)
      .get(API)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const rowsB = res.body as { id: string }[];
    const ids = rowsB.map((x) => String(x.id));
    expect(ids).toContain(String(docA._id));
    expect(ids).not.toContain(String(docB._id));

    const row = (res.body as { id: string; acknowledgedCount: number }[]).find(
      (x) => String(x.id) === String(docA._id),
    );
    expect(row?.acknowledgedCount).toBe(1);

    await DocumentDelivery.deleteMany({
      documentId: { $in: [docA._id, docB._id] },
    });
    await CompanyDocument.deleteMany({ _id: { $in: [docA._id, docB._id] } });
    await User.deleteMany({
      _id: { $in: [wA._id, wB._id, adminAOid, adminBOid] },
    });
    await Company.deleteMany({ _id: { $in: [companyAOid, companyBOid] } });
  });
});
