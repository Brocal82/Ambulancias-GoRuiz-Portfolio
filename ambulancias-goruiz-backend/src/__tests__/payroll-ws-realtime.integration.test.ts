/**
 * Payroll websocket realtime — payroll_changed emission.
 *
 * Covers:
 * - Single manual upload → worker + admin receive payroll_changed
 * - Batch upload (matched file) → matched worker + admin receive payroll_changed
 * - Assignment → newly assigned worker + admin receive payroll_changed
 * - Invalidation → owning worker + admin receive payroll_changed
 * - Cross-tenant isolation: other-company users do not receive the event
 * - Payload contains only { event }
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
} from "./test-helpers";
import Company from "../modules/companies/models/company.model";
import PayrollDocument from "../modules/payroll/models/payroll-document.model";
import User from "../modules/users/models/user.model";
import { setupWebSocketServer, WS_EVENTS } from "../modules/notifications";
import { __wsTestHooks } from "../modules/notifications/ws-manager";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import * as notificationsService from "../modules/notifications/services/notifications.service";

const API = "/api";

/** Minimal valid PDF bytes. */
const MINIMAL_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<</Size 1>>\nstartxref\n9\n%%EOF");

function connectWs(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function waitForWsMessage(ws: WebSocket, timeoutMs = 5000): Promise<{ event: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS message timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)) as { event: string });
    });
  });
}

function waitForWsMessages(
  ws: WebSocket,
  count: number,
  timeoutMs = 5000,
): Promise<{ event: string }[]> {
  return new Promise((resolve, reject) => {
    const frames: { event: string }[] = [];
    const timer = setTimeout(
      () => reject(new Error(`WS message timeout (got ${frames.length}/${count})`)),
      timeoutMs,
    );
    const onMessage = (data: unknown) => {
      frames.push(JSON.parse(String(data)) as { event: string });
      if (frames.length >= count) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(frames);
      }
    };
    ws.on("message", onMessage);
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

describe("Payroll ws-realtime — payroll_changed", () => {
  let server: http.Server;
  let port: number;

  let companyAId: string;
  let adminAToken: string;
  let workerAId: string;
  let workerAToken: string;

  let companyBId: string;
  let adminBToken: string;
  let workerBToken: string;

  const createdPayrollIds: string[] = [];

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    server = http.createServer();
    setupWebSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;

    // Company A — has payroll module
    const dataA = await createTestAdminWithCompany();
    companyAId = dataA.companyId;
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

    // Company B — has payroll module (for cross-tenant isolation)
    const dataB = await createTestAdminWithCompany();
    companyBId = dataB.companyId;
    adminBToken = dataB.adminToken;

    await Company.updateOne(
      { _id: companyBId },
      { $set: { enabledModules: [MODULE_KEYS.PAYROLL] } },
    );

    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyBId),
      Date.now() + 1,
    );
    const workerBId = String(workerB._id);
    workerBToken = issueTestJwt(workerBId, "worker", companyBId);
  });

  afterAll(async () => {
    if (createdPayrollIds.length > 0) {
      await PayrollDocument.deleteMany({ _id: { $in: createdPayrollIds.map((id) => new mongoose.Types.ObjectId(id)) } });
    }
    __wsTestHooks.clearClients();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(notificationsService, "sendPushNotification").mockResolvedValue();
  });

  it("single manual upload → worker receives payroll_changed", async () => {
    const workerWs = await connectWs(port, workerAToken);
    const msgPromise = waitForWsMessage(workerWs);

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("workerId", workerAId)
      .field("year", "2030")
      .field("month", "1")
      .attach("payroll", MINIMAL_PDF, { filename: "nomina-01-2030.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    createdPayrollIds.push(String(res.body.payrollId));

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    workerWs.close();
  });

  it("single manual upload → admin receives payroll_changed", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("workerId", workerAId)
      .field("year", "2030")
      .field("month", "2")
      .attach("payroll", MINIMAL_PDF, { filename: "nomina-02-2030.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    createdPayrollIds.push(String(res.body.payrollId));

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    adminWs.close();
  });

  it("single manual upload payload contains only event field", async () => {
    const workerWs = await connectWs(port, workerAToken);
    const msgPromise = waitForWsMessage(workerWs);

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("workerId", workerAId)
      .field("year", "2030")
      .field("month", "3")
      .attach("payroll", MINIMAL_PDF, { filename: "nomina-03-2030.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    createdPayrollIds.push(String(res.body.payrollId));

    const frame = await msgPromise;
    expect(Object.keys(frame)).toEqual(["event"]);
    workerWs.close();
  });

  it("assignment → assigned worker receives payroll_changed", async () => {
    // First upload as unmatched (no workerId, unrecognized filename)
    const uploadRes = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("year", "2030")
      .field("month", "4")
      .attach("payroll", MINIMAL_PDF, { filename: "ZZZUNKNOWN-04-2030.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    const payrollId = String(uploadRes.body.payrollId);
    createdPayrollIds.push(payrollId);

    const workerWs = await connectWs(port, workerAToken);
    const msgPromise = waitForWsMessage(workerWs);

    const assignRes = await request(app)
      .patch(`${API}/payroll/${payrollId}/assign`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ workerId: workerAId });

    expect(assignRes.status).toBe(200);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    workerWs.close();
  });

  it("assignment → admin receives payroll_changed", async () => {
    // Upload another unmatched doc
    const uploadRes = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("year", "2030")
      .field("month", "5")
      .attach("payroll", MINIMAL_PDF, { filename: "ZZZUNKNOWN2-05-2030.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    const payrollId = String(uploadRes.body.payrollId);
    createdPayrollIds.push(payrollId);

    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    const assignRes = await request(app)
      .patch(`${API}/payroll/${payrollId}/assign`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ workerId: workerAId });

    expect(assignRes.status).toBe(200);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    adminWs.close();
  });

  it("invalidation → owning worker receives payroll_changed", async () => {
    // Upload a doc assigned to worker
    const uploadRes = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("workerId", workerAId)
      .field("year", "2030")
      .field("month", "6")
      .attach("payroll", MINIMAL_PDF, { filename: "nomina-06-2030.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    const payrollId = String(uploadRes.body.payrollId);
    createdPayrollIds.push(payrollId);

    const workerWs = await connectWs(port, workerAToken);
    const msgPromise = waitForWsMessage(workerWs);

    const invalidRes = await request(app)
      .patch(`${API}/payroll/${payrollId}/invalidate`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(invalidRes.status).toBe(200);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    workerWs.close();
  });

  it("invalidation → admin receives payroll_changed", async () => {
    // Upload a doc assigned to worker
    const uploadRes = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("workerId", workerAId)
      .field("year", "2030")
      .field("month", "7")
      .attach("payroll", MINIMAL_PDF, { filename: "nomina-07-2030.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    const payrollId = String(uploadRes.body.payrollId);
    createdPayrollIds.push(payrollId);

    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    const invalidRes = await request(app)
      .patch(`${API}/payroll/${payrollId}/invalidate`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(invalidRes.status).toBe(200);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    adminWs.close();
  });

  it("cross-tenant isolation: company-B users do not receive company-A payroll_changed", async () => {
    const adminBWs = await connectWs(port, adminBToken);
    const workerBWs = await connectWs(port, workerBToken);
    const silentA = noWsMessageWithin(adminBWs, 600);
    const silentB = noWsMessageWithin(workerBWs, 600);

    const res = await request(app)
      .post(`${API}/payroll/upload`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("workerId", workerAId)
      .field("year", "2030")
      .field("month", "8")
      .attach("payroll", MINIMAL_PDF, { filename: "nomina-08-2030.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    createdPayrollIds.push(String(res.body.payrollId));

    expect(await silentA).toBe(true);
    expect(await silentB).toBe(true);
    adminBWs.close();
    workerBWs.close();
  });

  it("batch upload → matched worker receives payroll_changed", async () => {
    // Set employeeNumber so the auto-matcher can match by filename
    await User.updateOne(
      { _id: new mongoose.Types.ObjectId(workerAId) },
      { $set: { employeeNumber: "BATCHTEST01" } },
    );

    const workerWs = await connectWs(port, workerAToken);
    const msgPromise = waitForWsMessage(workerWs);

    const res = await request(app)
      .post(`${API}/payroll/upload/batch`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .field("year", "2030")
      .field("month", "9")
      .attach("payrolls", MINIMAL_PDF, { filename: "BATCHTEST01-09-2030.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    const matched = (res.body.results as Array<{ status: string; payrollId?: string }>)
      .filter((r) => r.status === "matched");
    for (const m of matched) {
      if (m.payrollId) createdPayrollIds.push(m.payrollId);
    }

    if (matched.length > 0) {
      const frame = await msgPromise;
      expect(frame).toEqual({ event: WS_EVENTS.PAYROLL_CHANGED });
    }
    workerWs.close();

    await User.updateOne(
      { _id: new mongoose.Types.ObjectId(workerAId) },
      { $unset: { employeeNumber: "" } },
    );
  });
});
