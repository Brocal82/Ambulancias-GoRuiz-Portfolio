import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import User from "../users/models/user.model";
import UserSessionState from "../users/models/user-session-state.model";

const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocketServer(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const rawUrl = req.url ?? "";
    const qIdx = rawUrl.indexOf("?");
    const token = qIdx !== -1
      ? new URLSearchParams(rawUrl.slice(qIdx)).get("token")
      : null;

    if (!token) {
      ws.close(1008, "Unauthorized");
      return;
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId?: string;
        tokenVersion?: number;
        typ?: string;
      };

      // Step-up tokens must not open WS connections
      if (decoded.typ === "step_up") throw new Error("step_up token not allowed");

      userId = String(decoded.userId ?? "");
      if (!userId) throw new Error("No userId");

      // Mirror the same revocation checks as HTTP authenticateToken
      const userDoc = await User.findById(userId).select("isActive").lean();
      if (!userDoc || userDoc.isActive !== true) throw new Error("User inactive");

      const sessionState = await UserSessionState.findOne({ userId })
        .select("tokenVersion")
        .lean();
      const persistedVersion = Number((sessionState as any)?.tokenVersion ?? 0);
      if (persistedVersion !== (decoded.tokenVersion ?? 0)) throw new Error("Token revoked");
    } catch {
      ws.close(1008, "Unauthorized");
      return;
    }

    const set = clients.get(userId) ?? new Set<WebSocket>();
    clients.set(userId, set);
    set.add(ws);

    const cleanup = () => {
      set.delete(ws);
      if (set.size === 0) clients.delete(userId);
    };

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  console.log("[WS] WebSocket server activo en /ws");
}

export function notifyUsers(userIds: string[], event: string): void {
  const message = JSON.stringify({ event });
  for (const userId of userIds) {
    const sockets = clients.get(userId);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch {
          // ignore — client will reconnect
        }
      }
    }
  }
}
