/**
 * Session sync websocket integration tests — company/modules/account lifecycle events.
 */
import http from "http";
import { type AddressInfo } from "net";
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
  WS_EVENTS,
} from "../modules/notifications";
import { __wsTestHooks } from "../modules/notifications/ws-manager";
import type { UpdateCompanyInput } from "../modules/companies/schemas/company.schema";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import {
  updateCompany,
  deleteCompany,
} from "../modules/companies/services/companies.service";
import { deleteUserService } from "../modules/users/services/users.service";
import { authenticateWsToken } from "../modules/notifications/utils/ws-auth";

function connectWs(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function waitForWsMessage(ws: WebSocket, timeoutMs = 15_000): Promise<{ event: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS message timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)) as { event: string });
    });
  });
}

function waitForWsClose(ws: WebSocket, timeoutMs = 5000): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS close timeout")), timeoutMs);
    ws.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code });
    });
    ws.once("error", reject);
  });
}

describe("session-sync ws-realtime", () => {
  jest.setTimeout(60_000);

  let server: http.Server;
  let port: number;
  let companyAId: string;
  let companyBId: string;
  let workerAId: string;
  let workerBId: string;
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
      {
        $set: {
          enabledModules: [MODULE_KEYS.SCHEDULING, MODULE_KEYS.MESSAGES],
        },
      },
    );
    await Company.updateOne(
      { _id: companyBId },
      { $set: { enabledModules: [MODULE_KEYS.SCHEDULING] } },
    );
  });

  afterAll(async () => {
    __wsTestHooks.clearClients();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  it("enabledModules update emits modules_changed only to same-company users", async () => {
    const workerWs = await connectWs(port, workerAToken);
    const otherCompanyWs = await connectWs(port, workerBToken);

    const workerMsgPromise = waitForWsMessage(workerWs);
    const otherMsgPromise = waitForWsMessage(otherCompanyWs).then(() => "unexpected");

    await updateCompany(companyAId, {
      enabledModules: [MODULE_KEYS.SCHEDULING, MODULE_KEYS.MESSAGES, MODULE_KEYS.WORKDAY],
    } as UpdateCompanyInput);

    const frame = await workerMsgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.MODULES_CHANGED });

    await expect(
      Promise.race([
        otherMsgPromise,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    workerWs.close();
    otherCompanyWs.close();
  });

  it("skips modules_changed when enabledModules unchanged", async () => {
    const workerWs = await connectWs(port, workerAToken);
    let received = false;
    workerWs.on("message", () => {
      received = true;
    });

    await updateCompany(companyAId, {
      enabledModules: [MODULE_KEYS.SCHEDULING, MODULE_KEYS.MESSAGES, MODULE_KEYS.WORKDAY],
    } as UpdateCompanyInput);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toBe(false);
    workerWs.close();
  });

  it("company deactivation emits company_changed only to same-company users", async () => {
    const isolated = await createTestAdminWithCompany();
    const isolatedWorker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(isolated.companyId),
      Date.now() + 200,
    );
    const isolatedWorkerId = String(isolatedWorker._id);
    const isolatedWorkerToken = issueTestJwt(
      isolatedWorkerId,
      "worker",
      isolated.companyId,
    );

    const workerWs = await connectWs(port, isolatedWorkerToken);
    const otherCompanyWs = await connectWs(port, workerBToken);

    const workerMsgPromise = waitForWsMessage(workerWs);
    const otherMsgPromise = waitForWsMessage(otherCompanyWs).then(() => "unexpected");

    await updateCompany(isolated.companyId, { isActive: false } as UpdateCompanyInput);

    const frame = await workerMsgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.COMPANY_CHANGED });

    await expect(
      Promise.race([
        otherMsgPromise,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 300)),
      ]),
    ).resolves.toBe("timeout");

    workerWs.close();
    otherCompanyWs.close();

    await Company.updateOne({ _id: isolated.companyId }, { $set: { isActive: true } });
  });

  it("company soft-delete emits company_changed to same-company users", async () => {
    const isolated = await createTestAdminWithCompany();
    const isolatedWorker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(isolated.companyId),
      Date.now() + 300,
    );
    const isolatedWorkerId = String(isolatedWorker._id);
    const isolatedWorkerToken = issueTestJwt(
      isolatedWorkerId,
      "worker",
      isolated.companyId,
    );

    const workerWs = await connectWs(port, isolatedWorkerToken);
    const msgPromise = waitForWsMessage(workerWs);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await deleteCompany(isolated.companyId);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.COMPANY_CHANGED });
    workerWs.close();
  });

  it("user delete emits account_changed to target user", async () => {
    const disposable = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyAId),
      Date.now() + 400,
    );
    const disposableId = String(disposable._id);
    const disposableToken = issueTestJwt(disposableId, "worker", companyAId);

    const workerWs = await connectWs(port, disposableToken);
    const msgPromise = waitForWsMessage(workerWs);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await deleteUserService(disposableId, companyAId);

    const frame = await msgPromise;
    expect(frame).toEqual({ event: WS_EVENTS.ACCOUNT_CHANGED });
    workerWs.close();
  });

  it("rejects websocket reconnect for inactive company", async () => {
    const isolated = await createTestAdminWithCompany();
    const isolatedWorker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(isolated.companyId),
      Date.now() + 500,
    );
    const isolatedWorkerId = String(isolatedWorker._id);
    const isolatedWorkerToken = issueTestJwt(
      isolatedWorkerId,
      "worker",
      isolated.companyId,
    );

    await Company.updateOne({ _id: isolated.companyId }, { $set: { isActive: false } });

    const auth = await authenticateWsToken(isolatedWorkerToken);
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.reason).toMatch(/company inactive/i);
    }

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(isolatedWorkerToken)}`,
    );
    const closed = await waitForWsClose(ws);
    expect(closed.code).toBe(1008);

    await Company.updateOne({ _id: isolated.companyId }, { $set: { isActive: true } });
  });
});
