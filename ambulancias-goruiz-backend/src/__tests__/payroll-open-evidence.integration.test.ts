/**
 * P1.3 — Payroll Open Evidence (compliance hardening)
 *
 * Covers:
 *  - First open: firstOpenedAt set, lastOpenedAt set, openCount = 1
 *  - Repeated open: firstOpenedAt unchanged, lastOpenedAt updated, openCount incremented
 *  - Open count increment: each successful access increments openCount by 1
 *  - Tenant isolation: cross-company worker cannot access file; evidence not affected
 *  - Admin access: admin opening does not record open evidence (worker-only tracking)
 *  - payroll_changed emitted to admins after worker open evidence update
 */
import http from "http";
import type { AddressInfo } from "net";
import mongoose from "mongoose";
import request from "supertest";
import { WebSocket } from "ws";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
  uniqueUploadBasename,
  writeTestUploadFile,
  removeTestUploadFile,
} from "./test-helpers";
import Company from "../modules/companies/models/company.model";
import PayrollDocument from "../modules/payroll/models/payroll-document.model";
import User from "../modules/users/models/user.model";
import { setupWebSocketServer, WS_EVENTS } from "../modules/notifications";
import { __wsTestHooks } from "../modules/notifications/ws-manager";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";

const API = "/api";

const MINIMAL_PDF_CONTENT = "%PDF-1.4 test-payroll-open-evidence";

function connectWs(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function waitForWsMessage(ws: WebSocket, timeoutMs = 3000): Promise<{ event: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("WS message timeout")),
      timeoutMs,
    );
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)) as { event: string });
    });
  });
}

function noWsMessageWithin(ws: WebSocket, waitMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      resolve(true);
    }, waitMs);
    const handler = () => {
      clearTimeout(timer);
      ws.off("message", handler);
      resolve(false);
    };
    ws.on("message", handler);
  });
}

describe("P1.3 — Payroll open evidence (integration)", () => {
  let server: http.Server;
  let port: number;

  let companyAId: string;
  let adminAId: string;
  let adminAToken: string;
  let workerAId: string;
  let workerAToken: string;

  let companyBId: string;
  let adminBId: string;
  let workerBId: string;
  let workerBToken: string;

  const createdPayrollIds: string[] = [];
  const createdFiles: string[] = [];

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    server = http.createServer();
    setupWebSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;

    // Company A
    const dataA = await createTestAdminWithCompany();
    companyAId = dataA.companyId;
    adminAId = dataA.adminId;
    adminAToken = dataA.adminToken;

    await Company.updateOne(
      { _id: companyAId },
      { $set: { enabledModules: [MODULE_KEYS.PAYROLL] } },
    );

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyAId),
      Date.now(),
    );
    workerAId = String(workerA._id);
    workerAToken = issueTestJwt(workerAId, "worker", companyAId);

    // Company B (cross-tenant isolation)
    const dataB = await createTestAdminWithCompany();
    companyBId = dataB.companyId;
    adminBId = dataB.adminId;

    await Company.updateOne(
      { _id: companyBId },
      { $set: { enabledModules: [MODULE_KEYS.PAYROLL] } },
    );

    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyBId),
      Date.now() + 1,
    );
    workerBId = String(workerB._id);
    workerBToken = issueTestJwt(workerBId, "worker", companyBId);
  });

  afterAll(async () => {
    if (createdPayrollIds.length > 0) {
      await PayrollDocument.deleteMany({
        _id: { $in: createdPayrollIds.map((id) => new mongoose.Types.ObjectId(id)) },
      });
    }
    for (const f of createdFiles) {
      await removeTestUploadFile(f);
    }
    await User.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(adminAId),
          new mongoose.Types.ObjectId(workerAId),
          new mongoose.Types.ObjectId(adminBId),
          new mongoose.Types.ObjectId(workerBId),
        ],
      },
    });
    await Company.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(companyAId),
          new mongoose.Types.ObjectId(companyBId),
        ],
      },
    });
    __wsTestHooks.clearClients();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  /** Creates a PayrollDocument with a real file on disk for workerA. */
  async function seedPayrollForWorkerA(): Promise<{ docId: string; filename: string }> {
    const basename = uniqueUploadBasename("payroll-evidence-test");
    await writeTestUploadFile(basename, MINIMAL_PDF_CONTENT);
    createdFiles.push(basename);

    const doc = await PayrollDocument.create({
      workerId: new mongoose.Types.ObjectId(workerAId),
      companyId: new mongoose.Types.ObjectId(companyAId),
      uploadedBy: new mongoose.Types.ObjectId(adminAId),
      filename: basename,
      originalName: "nomina-test.pdf",
      fileUrl: `/uploads/${basename}`,
      matchStatus: "manual",
      year: 2025,
      month: 6,
      deletedAt: null,
    });

    const docId = String(doc._id);
    createdPayrollIds.push(docId);
    return { docId, filename: basename };
  }

  it("first open: sets firstOpenedAt, lastOpenedAt, openCount = 1", async () => {
    const { docId, filename } = await seedPayrollForWorkerA();

    const res = await request(app)
      .get(`${API}/files/${filename}`)
      .set("Authorization", `Bearer ${workerAToken}`);

    expect(res.status).toBe(200);

    // Allow fire-and-forget update to complete
    await new Promise((r) => setTimeout(r, 200));

    const updated = await PayrollDocument.findById(docId).lean();
    expect(updated).not.toBeNull();
    expect(updated!.firstOpenedAt).toBeInstanceOf(Date);
    expect(updated!.lastOpenedAt).toBeInstanceOf(Date);
    expect(updated!.openCount).toBe(1);
  });

  it("repeated open: firstOpenedAt unchanged, lastOpenedAt updated, openCount incremented", async () => {
    const { docId, filename } = await seedPayrollForWorkerA();

    // First access
    await request(app)
      .get(`${API}/files/${filename}`)
      .set("Authorization", `Bearer ${workerAToken}`);
    await new Promise((r) => setTimeout(r, 200));

    const afterFirst = await PayrollDocument.findById(docId).lean();
    expect(afterFirst!.openCount).toBe(1);
    const firstOpenedAt = afterFirst!.firstOpenedAt;

    // Small delay to ensure timestamps differ
    await new Promise((r) => setTimeout(r, 50));

    // Second access
    await request(app)
      .get(`${API}/files/${filename}`)
      .set("Authorization", `Bearer ${workerAToken}`);
    await new Promise((r) => setTimeout(r, 200));

    const afterSecond = await PayrollDocument.findById(docId).lean();
    expect(afterSecond!.openCount).toBe(2);
    expect(afterSecond!.firstOpenedAt?.getTime()).toBe(firstOpenedAt?.getTime());
    expect(afterSecond!.lastOpenedAt!.getTime()).toBeGreaterThanOrEqual(
      afterFirst!.lastOpenedAt!.getTime(),
    );
  });

  it("open count increments correctly across multiple accesses", async () => {
    const { docId, filename } = await seedPayrollForWorkerA();

    for (let i = 0; i < 3; i++) {
      await request(app)
        .get(`${API}/files/${filename}`)
        .set("Authorization", `Bearer ${workerAToken}`);
      await new Promise((r) => setTimeout(r, 150));
    }

    const doc = await PayrollDocument.findById(docId).lean();
    expect(doc!.openCount).toBe(3);
  });

  it("tenant isolation: cross-company worker is denied; evidence not modified", async () => {
    const { docId, filename } = await seedPayrollForWorkerA();

    const res = await request(app)
      .get(`${API}/files/${filename}`)
      .set("Authorization", `Bearer ${workerBToken}`);

    expect(res.status).toBe(403);

    // Allow any async update to complete (should not run)
    await new Promise((r) => setTimeout(r, 200));

    const doc = await PayrollDocument.findById(docId).lean();
    expect(doc!.firstOpenedAt).toBeNull();
    expect(doc!.openCount).toBe(0);
  });

  it("admin access does not record open evidence", async () => {
    const { docId, filename } = await seedPayrollForWorkerA();

    const res = await request(app)
      .get(`${API}/files/${filename}`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 200));

    const doc = await PayrollDocument.findById(docId).lean();
    // Admin access must NOT increment openCount — only worker opens count
    expect(doc!.openCount).toBe(0);
    expect(doc!.firstOpenedAt).toBeNull();
  });

  it("payroll_changed emitted to admin after worker open evidence update", async () => {
    const { filename } = await seedPayrollForWorkerA();

    const adminWs = await connectWs(port, adminAToken);
    // Drain any prior messages
    await noWsMessageWithin(adminWs, 100);

    await request(app)
      .get(`${API}/files/${filename}`)
      .set("Authorization", `Bearer ${workerAToken}`);

    const msg = await waitForWsMessage(adminWs, 3000);
    expect(msg.event).toBe(WS_EVENTS.PAYROLL_CHANGED);

    adminWs.close();
  });
});
