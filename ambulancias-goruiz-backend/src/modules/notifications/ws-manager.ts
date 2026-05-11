import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocketServer(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
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
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId?: string };
      userId = String(decoded.userId ?? "");
      if (!userId) throw new Error("No userId");
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
