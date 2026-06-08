/**
 * P2 Phase 1 — Praemien websocket realtime (manual daily + save-monthly).
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
import PraemienManualDailyEntry from "../modules/praemien/models/praemien-manual-daily-entry.model";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import MonthlyPraemie from "../modules/praemien/models/monthly-praemie.model";
import User from "../modules/users/models/user.model";
import {
  setupWebSocketServer,
  voidEmitPraemienAdminSideEffects,
  WS_EVENTS,
} from "../modules/notifications";
import { __wsTestHooks } from "../modules/notifications/ws-manager";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import * as wsNotify from "../modules/notifications/utils/ws-notify";
import * as notificationsService from "../modules/notifications/services/notifications.service";

const API = "/api";

const SAVE_YEAR = 2034;
const SAVE_MONTH = 3;

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

describe("P2 praemien ws-realtime", () => {
  let server: http.Server;
  let port: number;
  let companyAId: string;
  let companyBId: string;
  let adminAId: string;
  let adminAToken: string;
  let workerAId: string;
  let workerAToken: string;
  let adminBToken: string;
  let assignmentKey: string;
  let manualDateStr: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    server = http.createServer();
    setupWebSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;

    const dataA = await createTestAdminWithCompany();
    companyAId = dataA.companyId;
    adminAId = dataA.adminId;
    adminAToken = dataA.adminToken;

    await Company.updateOne(
      { _id: companyAId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: 2020, month: 1 },
          enabledModules: [
            MODULE_KEYS.PRAEMIEN,
            MODULE_KEYS.WORKDAY,
          ],
        },
      },
    );

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyAId),
      Date.now(),
    );
    workerAId = String(workerA._id);
    workerAToken = issueTestJwt(workerAId, "worker", companyAId);

    const dataB = await createTestAdminWithCompany();
    companyBId = dataB.companyId;
    adminBToken = dataB.adminToken;

    const now = new Date();
    manualDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    assignmentKey = `praem-ws-${Date.now()}`;

    await WorkdaySummary.create({
      date: manualDateStr,
      assignmentId: assignmentKey,
      driver: new mongoose.Types.ObjectId(workerAId),
      medic: new mongoose.Types.ObjectId(workerAId),
      ambulanceId: new mongoose.Types.ObjectId(),
      ambulanceNumber: "99",
      initialKm: 0,
      totalDienstKm: 1,
      trips: [
        {
          auftragNumber: "MT",
          patientName: "P",
          fromAddress: "A",
          toAddress: "B",
          timeWarning: "08:00",
          wasCancelled: false,
          countsTrip: 1 as const,
        },
      ],
      totalEffectivePatients: 1,
      totalRealTrips: 1,
      companyId: new mongoose.Types.ObjectId(companyAId),
      isFinalClosure: true,
    });
  });

  afterAll(async () => {
    await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
    await PraemienManualDailyEntry.deleteMany({
      userId: new mongoose.Types.ObjectId(workerAId),
      date: manualDateStr,
    });
    await MonthlyPraemie.deleteMany({ userId: workerAId });
    __wsTestHooks.clearClients();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await PraemienManualDailyEntry.deleteMany({
      userId: new mongoose.Types.ObjectId(workerAId),
      date: manualDateStr,
    });
  });

  it("delivers praemien_changed to same-company admin on worker submit", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ date: manualDateStr, workerSubmittedValue: 5, status: "submitted" })
      .expect(200);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PRAEMIEN_CHANGED });

    adminWs.close();
  });

  it("worker submit emits admin_counts_changed when pending count changes", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const msgsPromise = waitForWsMessages(adminWs, 2);

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ date: manualDateStr, workerSubmittedValue: 6, status: "submitted" })
      .expect(200);

    const frames = await msgsPromise;
    const events = frames.map((f) => f.event).sort();
    expect(events).toEqual(
      [WS_EVENTS.ADMIN_COUNTS_CHANGED, WS_EVENTS.PRAEMIEN_CHANGED].sort(),
    );

    adminWs.close();
  });

  it("admin approve emits praemien_changed to affected worker", async () => {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ date: manualDateStr, workerSubmittedValue: 7, status: "submitted" })
      .expect(200);

    const workerWs = await connectWs(port, workerAToken);
    const msgPromise = waitForWsMessage(workerWs);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/approve`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ userId: workerAId, date: manualDateStr })
      .expect(200);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.PRAEMIEN_CHANGED });

    workerWs.close();
  });

  it("admin approve cascade emits praemien_changed to synced Dienst partner", async () => {
    const medic = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyAId),
      Date.now() + 991,
    );
    const medicId = String(medic._id);
    const medicToken = issueTestJwt(medicId, "worker", companyAId);

    await WorkdaySummary.updateOne(
      { assignmentId: assignmentKey },
      {
        $set: {
          driver: new mongoose.Types.ObjectId(workerAId),
          medic: new mongoose.Types.ObjectId(medicId),
        },
      },
    );

    try {
      await request(app)
        .put(`${API}/praemien/manual-daily`)
        .set("Authorization", `Bearer ${workerAToken}`)
        .send({ date: manualDateStr, workerSubmittedValue: 7, status: "submitted" })
        .expect(200);

      const medicWs = await connectWs(port, medicToken);
      const msgPromise = waitForWsMessage(medicWs);

      await request(app)
        .post(`${API}/praemien/manual-daily/admin/approve`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .send({ userId: workerAId, date: manualDateStr, adminFinalValue: 9 })
        .expect(200);

      const frame = await msgPromise;
      expect(frame).toEqual({ event: WS_EVENTS.PRAEMIEN_CHANGED });

      medicWs.close();
    } finally {
      await WorkdaySummary.updateOne(
        { assignmentId: assignmentKey },
        {
          $set: {
            driver: new mongoose.Types.ObjectId(workerAId),
            medic: new mongoose.Types.ObjectId(workerAId),
          },
        },
      );
      await PraemienManualDailyEntry.deleteMany({
        companyId: new mongoose.Types.ObjectId(companyAId),
        date: manualDateStr,
        userId: new mongoose.Types.ObjectId(medicId),
      });
      await User.deleteOne({ _id: medic._id });
    }
  });

  it("admin reject emits admin_counts_changed when pending count changes", async () => {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ date: manualDateStr, workerSubmittedValue: 8, status: "submitted" })
      .expect(200);

    const adminWs = await connectWs(port, adminAToken);
    const msgsPromise = waitForWsMessages(adminWs, 2);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/reject`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ userId: workerAId, date: manualDateStr, reason: "test" })
      .expect(200);

    const frames = await msgsPromise;
    const events = frames.map((f) => f.event).sort();
    expect(events).toEqual(
      [WS_EVENTS.ADMIN_COUNTS_CHANGED, WS_EVENTS.PRAEMIEN_CHANGED].sort(),
    );

    adminWs.close();
  });

  it("save-monthly emits praemien_changed to affected user", async () => {
    const saveAssignmentKey = `praem-ws-save-${Date.now()}`;
    const saveDate = `${SAVE_YEAR}-${String(SAVE_MONTH).padStart(2, "0")}-10`;

    await WorkdaySummary.create({
      date: saveDate,
      assignmentId: saveAssignmentKey,
      driver: new mongoose.Types.ObjectId(adminAId),
      medic: new mongoose.Types.ObjectId(adminAId),
      ambulanceId: new mongoose.Types.ObjectId(),
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [
        {
          auftragNumber: "S1",
          patientName: "P1",
          fromAddress: "A",
          toAddress: "B",
          timeWarning: "08:00",
          wasCancelled: false,
          countsTrip: 1 as const,
        },
      ],
      totalEffectivePatients: 8,
      totalRealTrips: 1,
      companyId: new mongoose.Types.ObjectId(companyAId),
      isFinalClosure: true,
    });

    await Company.updateOne(
      { _id: companyAId },
      { $set: { praemienMode: "automatic" } },
    );

    try {
      const adminWs = await connectWs(port, adminAToken);
      const msgPromise = waitForWsMessage(adminWs);

      await request(app)
        .post(`${API}/praemien/save-monthly`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .query({ year: SAVE_YEAR, month: SAVE_MONTH })
        .expect(200);

      const frame = await msgPromise;
      expect(frame).toEqual({ event: WS_EVENTS.PRAEMIEN_CHANGED });

      adminWs.close();
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: saveAssignmentKey });
      await MonthlyPraemie.deleteMany({ userId: adminAId, year: SAVE_YEAR, month: SAVE_MONTH });
      await Company.updateOne(
        { _id: companyAId },
        {
          $set: {
            praemienMode: "manual",
            praemienModeEffectiveFrom: { year: 2020, month: 1 },
          },
        },
      );
    }
  });

  it("does not deliver praemien_changed across companies", async () => {
    const adminBWs = await connectWs(port, adminBToken);
    const unexpected = waitForWsMessage(adminBWs).then(() => "unexpected");

    voidEmitPraemienAdminSideEffects(companyAId);
    await new Promise((r) => setTimeout(r, 50));

    await expect(
      Promise.race([
        unexpected,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    adminBWs.close();
  });

  it("does not deliver when Praemien module is disabled for company", async () => {
    const companyNoPraem = await createTestAdminWithCompany();
    await Company.updateOne(
      { _id: companyNoPraem.companyId },
      { $pull: { enabledModules: MODULE_KEYS.PRAEMIEN } },
    );

    const adminWs = await connectWs(port, companyNoPraem.adminToken);
    const unexpected = waitForWsMessage(adminWs).then(() => "unexpected");

    voidEmitPraemienAdminSideEffects(companyNoPraem.companyId);
    await new Promise((r) => setTimeout(r, 50));

    await expect(
      Promise.race([
        unexpected,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    adminWs.close();
    await User.deleteOne({ _id: companyNoPraem.adminId });
    await Company.deleteOne({ _id: companyNoPraem.companyId });
  });

  it("payload remains minimal { event } only", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    voidEmitPraemienAdminSideEffects(companyAId);
    await new Promise((r) => setTimeout(r, 50));

    const frame = await msgPromise;
    expect(Object.keys(frame).sort()).toEqual(["event"]);
    expect(frame.event).toBe(WS_EVENTS.PRAEMIEN_CHANGED);

    adminWs.close();
  });

  it("does not emit on failed worker submit (400)", async () => {
    const adminEmitSpy = jest.spyOn(wsNotify, "voidEmitPraemienAdminSideEffects");

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ date: "invalid-date", workerSubmittedValue: 1, status: "submitted" })
      .expect(400);

    await new Promise((r) => setTimeout(r, 20));
    expect(adminEmitSpy).not.toHaveBeenCalled();
  });

  it("does not emit on failed admin approve (404)", async () => {
    const workerEmitSpy = jest.spyOn(wsNotify, "voidEmitPraemienWorkerRefresh");
    const adminEmitSpy = jest.spyOn(wsNotify, "voidEmitPraemienAdminSideEffects");

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/approve`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({
        userId: workerAId,
        date: "2099-01-01",
      })
      .expect(404);

    await new Promise((r) => setTimeout(r, 20));
    expect(workerEmitSpy).not.toHaveBeenCalled();
    expect(adminEmitSpy).not.toHaveBeenCalled();
  });

  it("preserves existing push on admin approve", async () => {
    const pushSpy = jest.spyOn(notificationsService, "sendPushNotification");

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({ date: manualDateStr, workerSubmittedValue: 9, status: "submitted" })
      .expect(200);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/approve`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ userId: workerAId, date: manualDateStr })
      .expect(200);

    await new Promise((r) => setTimeout(r, 20));
    expect(pushSpy).toHaveBeenCalled();
    const lastCall = pushSpy.mock.calls[pushSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).toEqual([workerAId]);
    expect(String(lastCall?.[1])).toMatch(/aprobada/i);
  });
});
