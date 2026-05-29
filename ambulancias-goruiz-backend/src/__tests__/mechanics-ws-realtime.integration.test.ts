/**
 * P2 Phase 1 — mechanics issue reports websocket realtime.
 */
import http from "http";
import type { AddressInfo } from "net";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
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
import User from "../modules/users/models/user.model";
import Dienst from "../modules/diensts/models/dienst.model";
import MechanicsIssue from "../modules/mechanics/models/mechanics-issue.model";
import {
  setupWebSocketServer,
  __wsTestHooks,
} from "../modules/notifications/ws-manager";
import { voidEmitMechanicsChanged, WS_EVENTS } from "../modules/notifications";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import * as wsNotify from "../modules/notifications/utils/ws-notify";
import { getWeekMongoDateRange } from "../utils/time";

const API = "/api";

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

describe("P2 mechanics ws-realtime", () => {
  let server: http.Server;
  let port: number;
  let companyAId: string;
  let companyBId: string;
  let adminAId: string;
  let adminAToken: string;
  let jefeAToken: string;
  let mecanicoAToken: string;
  let workerAId: string;
  let workerAToken: string;
  let adminBToken: string;
  let assignmentId: string;
  let issueForSeenId: string;
  let issueForDeleteId: string;

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
      { $addToSet: { enabledModules: MODULE_KEYS.MECHANICS } },
    );

    const jefe = await User.create({
      name: "Jefe",
      lastName: "Mec",
      email: `jefe-mec-${Date.now()}@example.com`,
      password: await bcrypt.hash("password123", 10),
      role: "jefe_mecanicos",
      companyId: new mongoose.Types.ObjectId(companyAId),
    });
    jefeAToken = issueTestJwt(String(jefe._id), "jefe_mecanicos", companyAId);

    const mecanico = await User.create({
      name: "Mec",
      lastName: "Test",
      email: `mecanico-ws-${Date.now()}@example.com`,
      password: await bcrypt.hash("password123", 10),
      role: "mecanico",
      companyId: new mongoose.Types.ObjectId(companyAId),
    });
    mecanicoAToken = issueTestJwt(String(mecanico._id), "mecanico", companyAId);

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyAId),
      Date.now(),
    );
    workerAId = String(workerA._id);
    workerAToken = issueTestJwt(workerAId, "worker", companyAId);

    const dataB = await createTestAdminWithCompany();
    companyBId = dataB.companyId;
    adminBToken = dataB.adminToken;
    await Company.updateOne(
      { _id: companyBId },
      { $pull: { enabledModules: MODULE_KEYS.MECHANICS } },
    );

    const weekStart = "2099-06-01";
    const { start } = getWeekMongoDateRange(weekStart);
    const dienst = await Dienst.create({
      dienstNumber: 88001,
      weekStartDate: start,
      companyId: new mongoose.Types.ObjectId(companyAId),
      assignments: [
        {
          date: "2099-06-02",
          startTime: "08:00",
          endTime: "16:00",
          driver: new mongoose.Types.ObjectId(workerAId),
          medic: new mongoose.Types.ObjectId(adminAId),
        },
      ],
    });
    assignmentId = String(
      (dienst.assignments[0] as { _id: mongoose.Types.ObjectId })._id,
    );

    const companyOid = new mongoose.Types.ObjectId(companyAId);
    const [seenIssue, deleteIssue] = await Promise.all([
      MechanicsIssue.create({
        dienstNumber: 1,
        date: "2099-06-03",
        ambulanceNumber: "A1",
        timestamp: new Date().toISOString(),
        issueText: "for seen ws",
        companyId: companyOid,
      }),
      MechanicsIssue.create({
        dienstNumber: 1,
        date: "2099-06-04",
        ambulanceNumber: "A2",
        timestamp: new Date().toISOString(),
        issueText: "for delete ws",
        companyId: companyOid,
      }),
    ]);
    issueForSeenId = seenIssue._id.toString();
    issueForDeleteId = deleteIssue._id.toString();
  });

  afterAll(async () => {
    __wsTestHooks.clearClients();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("delivers mechanics_changed to mechanics stakeholders in same company", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const jefeWs = await connectWs(port, jefeAToken);
    const mecanicoWs = await connectWs(port, mecanicoAToken);

    const adminMsg = waitForWsMessage(adminWs);
    const jefeMsg = waitForWsMessage(jefeWs);
    const mecanicoMsg = waitForWsMessage(mecanicoWs);

    voidEmitMechanicsChanged(companyAId);
    await new Promise((r) => setTimeout(r, 50));

    const [adminFrame, jefeFrame, mecanicoFrame] = await Promise.all([
      adminMsg,
      jefeMsg,
      mecanicoMsg,
    ]);
    expect(adminFrame).toEqual({ event: WS_EVENTS.MECHANICS_CHANGED });
    expect(jefeFrame).toEqual({ event: WS_EVENTS.MECHANICS_CHANGED });
    expect(mecanicoFrame).toEqual({ event: WS_EVENTS.MECHANICS_CHANGED });

    adminWs.close();
    jefeWs.close();
    mecanicoWs.close();
  });

  it("does not deliver mechanics_changed across companies", async () => {
    const adminBWs = await connectWs(port, adminBToken);
    const unexpected = waitForWsMessage(adminBWs).then(() => "unexpected");

    voidEmitMechanicsChanged(companyAId);
    await new Promise((r) => setTimeout(r, 50));

    await expect(
      Promise.race([
        unexpected,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    adminBWs.close();
  });

  it("does not deliver when mechanics module is disabled for company", async () => {
    const companyNoMech = await createTestAdminWithCompany();
    await Company.updateOne(
      { _id: companyNoMech.companyId },
      { $pull: { enabledModules: MODULE_KEYS.MECHANICS } },
    );

    const adminWs = await connectWs(port, companyNoMech.adminToken);
    const unexpected = waitForWsMessage(adminWs).then(() => "unexpected");

    voidEmitMechanicsChanged(companyNoMech.companyId);
    await new Promise((r) => setTimeout(r, 50));

    await expect(
      Promise.race([
        unexpected,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    adminWs.close();
  });

  it("payload remains minimal { event } only", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    voidEmitMechanicsChanged(companyAId);
    await new Promise((r) => setTimeout(r, 50));

    const frame = await msgPromise;
    expect(Object.keys(frame).sort()).toEqual(["event"]);
    expect(frame.event).toBe(WS_EVENTS.MECHANICS_CHANGED);

    adminWs.close();
  });

  it("worker POST report-issue emits mechanics_changed once on success", async () => {
    const emitSpy = jest.spyOn(wsNotify, "voidEmitMechanicsChanged");

    await request(app)
      .post(`${API}/mechanics/report-issue`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({
        assignmentId,
        dienstNumber: "88001",
        date: "2099-06-02",
        timestamp: new Date().toISOString(),
        issueText: "avería ws test",
      })
      .expect(201);

    await new Promise((r) => setTimeout(r, 20));
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(companyAId);
  });

  it("PATCH issues/:id/seen emits mechanics_changed once on success", async () => {
    const emitSpy = jest.spyOn(wsNotify, "voidEmitMechanicsChanged");

    await request(app)
      .patch(`${API}/mechanics/issues/${issueForSeenId}/seen`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(200);

    await new Promise((r) => setTimeout(r, 20));
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(companyAId);
  });

  it("DELETE issues/:id emits mechanics_changed once on success", async () => {
    const emitSpy = jest.spyOn(wsNotify, "voidEmitMechanicsChanged");

    await request(app)
      .delete(`${API}/mechanics/issues/${issueForDeleteId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(200);

    await new Promise((r) => setTimeout(r, 20));
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(companyAId);
  });

  it("does not emit on failed PATCH seen (404)", async () => {
    const emitSpy = jest.spyOn(wsNotify, "voidEmitMechanicsChanged");
    const missingId = new mongoose.Types.ObjectId().toString();

    await request(app)
      .patch(`${API}/mechanics/issues/${missingId}/seen`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .expect(404);

    await new Promise((r) => setTimeout(r, 20));
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("does not emit on failed POST report-issue (400)", async () => {
    const emitSpy = jest.spyOn(wsNotify, "voidEmitMechanicsChanged");

    await request(app)
      .post(`${API}/mechanics/report-issue`)
      .set("Authorization", `Bearer ${workerAToken}`)
      .send({
        assignmentId,
        dienstNumber: "88001",
        date: "2099-06-02",
        timestamp: new Date().toISOString(),
        issueText: "",
      })
      .expect(400);

    await new Promise((r) => setTimeout(r, 20));
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
