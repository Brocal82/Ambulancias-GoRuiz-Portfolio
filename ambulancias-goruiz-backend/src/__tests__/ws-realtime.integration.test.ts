/**
 * P1 realtime websocket integration tests — tenant isolation and emit contracts.
 */
import http from "http";
import type { AddressInfo } from "net";
import mongoose from "mongoose";
import { WebSocket } from "ws";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
} from "./test-helpers";
import Company from "../modules/companies/models/company.model";
import {
  setupWebSocketServer,
  __wsTestHooks,
} from "../modules/notifications/ws-manager";
import {
  notifyUsersModuleGated,
  notifyCompanyAdminsModuleGated,
  voidEmitSchedulingMutationRealtime,
  WS_EVENTS,
} from "../modules/notifications";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";

function connectWs(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

/**
 * El servidor registra el socket tras autenticarlo de forma asíncrona (después del "open" del
 * cliente) y procesa los cierres también de forma asíncrona. Esperar al estado del servidor evita
 * emitir antes de que el socket nuevo esté registrado.
 */
async function waitForServerClientCount(
  userId: string,
  expected: number,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (__wsTestHooks.getClientCount(userId) !== expected) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `WS client count for ${userId} is ${__wsTestHooks.getClientCount(userId)}, expected ${expected}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
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

describe("P1 ws-realtime", () => {
  let server: http.Server;
  let port: number;
  let companyAId: string;
  let companyBId: string;
  let workerAId: string;
  let workerBId: string;
  let adminAToken: string;
  let workerAToken: string;
  let workerBToken: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    server = http.createServer();
    setupWebSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;

    const dataA = await createTestAdminWithCompany();
    companyAId = dataA.companyId;
    adminAToken = dataA.adminToken;

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyAId),
      Date.now(),
    );
    workerAId = String(workerA._id);
    workerAToken = issueTestJwt(workerAId, "worker", companyAId);

    const dataB = await createTestAdminWithCompany();
    companyBId = dataB.companyId;
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyBId),
      Date.now() + 99,
    );
    workerBId = String(workerB._id);
    workerBToken = issueTestJwt(workerBId, "worker", companyBId);

    await Company.updateOne(
      { _id: companyAId },
      { $addToSet: { enabledModules: { $each: [MODULE_KEYS.SCHEDULING, MODULE_KEYS.WORKDAY, MODULE_KEYS.VACATION] } } },
    );
    await Company.updateOne(
      { _id: companyBId },
      { $addToSet: { enabledModules: MODULE_KEYS.SCHEDULING } },
    );
  });

  afterAll(async () => {
    __wsTestHooks.clearClients();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  it("delivers module-gated agenda_changed only to same-company worker", async () => {
    const workerWs = await connectWs(port, workerAToken);
    const otherCompanyWs = await connectWs(port, workerBToken);

    const workerMsgPromise = waitForWsMessage(workerWs);
    const otherMsgPromise = waitForWsMessage(otherCompanyWs).then(
      () => "unexpected",
      () => "no-message", // timeout esperado: evita un rejection sin manejar tras el test
    );

    await notifyUsersModuleGated(
      [workerAId, workerBId],
      WS_EVENTS.AGENDA_CHANGED,
      MODULE_KEYS.SCHEDULING,
      companyAId,
    );

    const frame = await workerMsgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.AGENDA_CHANGED });

    await expect(
      Promise.race([
        otherMsgPromise,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    workerWs.close();
    otherCompanyWs.close();
  });

  it("voidEmitSchedulingMutationRealtime unions workers and notifies admins once each", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const workerWs = await connectWs(port, workerAToken);

    const adminMsg = waitForWsMessage(adminWs);
    const workerMsg = waitForWsMessage(workerWs);

    voidEmitSchedulingMutationRealtime(companyAId, new Set([workerAId]));

    const [adminFrame, workerFrame] = await Promise.all([adminMsg, workerMsg]);
    expect(adminFrame).toEqual({ event: WS_EVENTS.DIENST_CHANGED });
    expect(workerFrame).toEqual({ event: WS_EVENTS.AGENDA_CHANGED });

    adminWs.close();
    workerWs.close();
  });

  it("payload remains minimal { event } only", async () => {
    // Sockets del test anterior pueden seguir registrados hasta que el servidor procese su cierre.
    await waitForServerClientCount(workerAId, 0);
    const workerWs = await connectWs(port, workerAToken);
    await waitForServerClientCount(workerAId, 1);
    const msgPromise = waitForWsMessage(workerWs);

    await notifyUsersModuleGated(
      [workerAId],
      WS_EVENTS.WORKDAY_SUMMARY_CHANGED,
      MODULE_KEYS.WORKDAY,
      companyAId,
    );

    const frame = await msgPromise;
    expect(Object.keys(frame).sort()).toEqual(["event"]);
    expect(frame.event).toBe(WS_EVENTS.WORKDAY_SUMMARY_CHANGED);

    workerWs.close();
  });

  it("delivers vacation_request_changed to connected admin", async () => {
    const adminWs = await connectWs(port, adminAToken);
    const msgPromise = waitForWsMessage(adminWs);

    await notifyCompanyAdminsModuleGated(
      companyAId,
      WS_EVENTS.VACATION_REQUEST_CHANGED,
      MODULE_KEYS.VACATION,
    );

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.VACATION_REQUEST_CHANGED });
    adminWs.close();
  });
});
