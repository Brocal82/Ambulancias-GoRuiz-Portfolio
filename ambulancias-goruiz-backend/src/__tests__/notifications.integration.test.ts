/**
 * Notifications / push / websocket hardening integration tests.
 */
import http from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import mongoose from "mongoose";
import { WebSocket } from "ws";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
  issueTestStepUpToken,
} from "./test-helpers";
import { PushToken } from "../modules/notifications/models/push-token.model";
import { NotificationLog } from "../modules/notifications/models/notification-log.model";
import User from "../modules/users/models/user.model";
import UserSessionState from "../modules/users/models/user-session-state.model";
import Company from "../modules/companies/models/company.model";
import {
  sendPushNotification,
  __pushTestHooks,
} from "../modules/notifications/services/notifications.service";
import { setupWebSocketServer, __wsTestHooks } from "../modules/notifications/ws-manager";
import { authenticateWsToken } from "../modules/notifications/utils/ws-auth";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";

const API = "/api";

function connectWs(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
    ws.once("close", () => reject(new Error("closed before open")));
  });
}

function waitForWsClose(ws: WebSocket, timeoutMs = 3000): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS close timeout")), timeoutMs);
    ws.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code });
    });
  });
}

describe("Notifications hardening", () => {
  let companyId: string;
  let workerAId: string;
  let workerBId: string;
  let workerAToken: string;
  let workerBToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const data = await createTestAdminWithCompany();
    companyId = data.companyId;
    adminToken = data.adminToken;

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
      Date.now(),
    );
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
      Date.now() + 1,
    );
    workerAId = String(workerA._id);
    workerBId = String(workerB._id);

    const loginA = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerA.email, password: "password123" });
    const loginB = await request(app)
      .post(`${API}/users/login`)
      .send({ email: workerB.email, password: "password123" });

    workerAToken = loginA.body.token as string;
    workerBToken = loginB.body.token as string;
  }, 60_000);

  afterAll(async () => {
    await PushToken.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(workerAId),
          new mongoose.Types.ObjectId(workerBId),
        ],
      },
    });
    await NotificationLog.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(workerAId),
          new mongoose.Types.ObjectId(workerBId),
        ],
      },
    });
    await User.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(workerAId),
          new mongoose.Types.ObjectId(workerBId),
        ],
      },
    });
    await Company.deleteOne({ _id: companyId });
    await mongoose.disconnect();
  });

  describe("register-token auth", () => {
    it("POST /notifications/register-token sin token → 401", async () => {
      await request(app)
        .post(`${API}/notifications/register-token`)
        .send({ token: "ExponentPushToken[test]", platform: "android" })
        .expect(401);
    });

    it("POST /notifications/register-token como admin → 403", async () => {
      await request(app)
        .post(`${API}/notifications/register-token`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ token: "ExponentPushToken[admin]", platform: "android" })
        .expect(403);
    });

    it("POST /notifications/register-token como worker → 200", async () => {
      const res = await request(app)
        .post(`${API}/notifications/register-token`)
        .set("Authorization", `Bearer ${workerAToken}`)
        .send({ token: "ExponentPushToken[worker-a]", platform: "ios" })
        .expect(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe("history isolation", () => {
    beforeAll(async () => {
      await NotificationLog.create([
        {
          userId: new mongoose.Types.ObjectId(workerAId),
          title: "A only",
          body: "secret A",
          data: { screen: "messages" },
        },
        {
          userId: new mongoose.Types.ObjectId(workerBId),
          title: "B only",
          body: "secret B",
          data: { screen: "messages" },
        },
      ]);
    });

    it("GET /notifications/history devuelve solo logs del usuario autenticado", async () => {
      const res = await request(app)
        .get(`${API}/notifications/history`)
        .set("Authorization", `Bearer ${workerAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((item: { title: string }) => item.title === "A only")).toBe(true);
      expect(res.body.some((item: { title: string }) => item.title === "B only")).toBe(false);
    });
  });

  describe("unregister-token and duplicate token protection", () => {
    const sharedToken = "ExponentPushToken[shared-device]";

    it("registrar el mismo token en otro usuario elimina el registro anterior", async () => {
      await request(app)
        .post(`${API}/notifications/register-token`)
        .set("Authorization", `Bearer ${workerAToken}`)
        .send({ token: sharedToken, platform: "android" })
        .expect(200);

      await request(app)
        .post(`${API}/notifications/register-token`)
        .set("Authorization", `Bearer ${workerBToken}`)
        .send({ token: sharedToken, platform: "android" })
        .expect(200);

      const rows = await PushToken.find({ token: sharedToken }).lean();
      expect(rows).toHaveLength(1);
      expect(String(rows[0].userId)).toBe(workerBId);
    });

    it("POST /notifications/unregister-token elimina token del usuario", async () => {
      await request(app)
        .post(`${API}/notifications/unregister-token`)
        .set("Authorization", `Bearer ${workerBToken}`)
        .send({ token: sharedToken })
        .expect(200);

      const remaining = await PushToken.find({ token: sharedToken }).lean();
      expect(remaining).toHaveLength(0);
    });

    it("POST /notifications/unregister-token sin body elimina todos los tokens del usuario", async () => {
      await PushToken.create({
        userId: new mongoose.Types.ObjectId(workerAId),
        token: "ExponentPushToken[cleanup-1]",
        platform: "android",
      });
      await PushToken.create({
        userId: new mongoose.Types.ObjectId(workerAId),
        token: "ExponentPushToken[cleanup-2]",
        platform: "ios",
      });

      await request(app)
        .post(`${API}/notifications/unregister-token`)
        .set("Authorization", `Bearer ${workerAToken}`)
        .send({})
        .expect(200);

      const count = await PushToken.countDocuments({
        userId: new mongoose.Types.ObjectId(workerAId),
      });
      expect(count).toBe(0);
    });
  });

  describe("stale token cleanup on Expo provider failure", () => {
    const staleToken = "ExponentPushToken[stale]";

    beforeEach(async () => {
      await PushToken.create({
        userId: new mongoose.Types.ObjectId(workerAId),
        token: staleToken,
        platform: "android",
      });
    });

    afterEach(async () => {
      await PushToken.deleteMany({ token: staleToken });
      jest.restoreAllMocks();
    });

    it("elimina tokens con error DeviceNotRegistered de Expo", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
        }),
      } as Response;

      await __pushTestHooks.handleExpoPushResponse([staleToken], mockResponse);

      const remaining = await PushToken.find({ token: staleToken }).lean();
      expect(remaining).toHaveLength(0);
    });
  });

  describe("module-disabled no-push behavior", () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: "ok" }] }),
      } as Response);
    });

    afterEach(async () => {
      fetchSpy.mockRestore();
      await Company.updateOne(
        { _id: companyId },
        { $set: { enabledModules: Object.values(MODULE_KEYS) } },
      );
    });

    it("sendPushNotification con moduleKey omitido cuando módulo deshabilitado", async () => {
      await Company.updateOne(
        { _id: companyId },
        { $pull: { enabledModules: MODULE_KEYS.MESSAGES } },
      );

      await PushToken.create({
        userId: new mongoose.Types.ObjectId(workerAId),
        token: "ExponentPushToken[module-gate]",
        platform: "android",
      });

      await sendPushNotification(
        [workerAId],
        "Test",
        "Body",
        { screen: "messages" },
        { moduleKey: MODULE_KEYS.MESSAGES, actingCompanyId: companyId },
      );

      expect(fetchSpy).not.toHaveBeenCalled();

      await PushToken.deleteMany({ token: "ExponentPushToken[module-gate]" });
    });
  });

  describe("websocket auth rejection", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
      server = http.createServer(app);
      setupWebSocketServer(server);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      port = (server.address() as AddressInfo).port;
    });

    afterAll(async () => {
      __wsTestHooks.clearClients();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("rechaza conexión sin token", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const closed = await waitForWsClose(ws);
      expect(closed.code).toBe(1008);
    });

    it("rechaza token step-up", async () => {
      const stepUp = issueTestStepUpToken(workerAId);
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(stepUp)}`,
      );
      const closed = await waitForWsClose(ws);
      expect(closed.code).toBe(1008);
    });

    it("rechaza token revocado", async () => {
      await UserSessionState.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(workerAId) },
        { tokenVersion: 99 },
        { upsert: true },
      );

      const revokedToken = issueTestJwt(workerAId, "worker", companyId, 0);
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(revokedToken)}`,
      );
      const closed = await waitForWsClose(ws);
      expect(closed.code).toBe(1008);

      await UserSessionState.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(workerAId) },
        { tokenVersion: 0 },
        { upsert: true },
      );
    });

    it("rechaza usuario inactivo", async () => {
      await User.findByIdAndUpdate(workerAId, { isActive: false });
      const token = issueTestJwt(workerAId, "worker", companyId, 0);
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
      );
      const closed = await waitForWsClose(ws);
      expect(closed.code).toBe(1008);
      await User.findByIdAndUpdate(workerAId, { isActive: true });
    });

    it("acepta token worker válido", async () => {
      const ws = await connectWs(port, workerAToken);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe("authenticateWsToken helper", () => {
    it("rechaza step-up token", async () => {
      const result = await authenticateWsToken(issueTestStepUpToken(workerAId));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/step_up/i);
      }
    });
  });
});
