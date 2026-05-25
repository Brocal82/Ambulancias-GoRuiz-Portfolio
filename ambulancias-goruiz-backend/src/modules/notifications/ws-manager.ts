import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import { authenticateWsToken } from "./utils/ws-auth";

const clients = new Map<string, Set<WebSocket>>();

const WS_PING_INTERVAL_MS = 30_000;
const MAX_CONNECTIONS_PER_USER = 5;

type TrackedSocket = WebSocket & { isAlive?: boolean };

function extractWsToken(rawUrl: string): string | null {
  const qIdx = rawUrl.indexOf("?");
  if (qIdx === -1) return null;
  return new URLSearchParams(rawUrl.slice(qIdx)).get("token");
}

function enforceConnectionCap(userId: string, set: Set<WebSocket>, ws: WebSocket): void {
  while (set.size >= MAX_CONNECTIONS_PER_USER) {
    const oldest = set.values().next().value as WebSocket | undefined;
    if (!oldest) break;
    set.delete(oldest);
    try {
      oldest.close(1008, "Connection limit reached");
    } catch {
      /* noop */
    }
  }
  set.add(ws);
}

function startHeartbeat(wss: WebSocketServer): NodeJS.Timeout {
  return setInterval(() => {
    for (const ws of wss.clients) {
      const tracked = ws as TrackedSocket;
      if (tracked.isAlive === false) {
        tracked.terminate();
        continue;
      }
      tracked.isAlive = false;
      try {
        tracked.ping();
      } catch {
        tracked.terminate();
      }
    }
  }, WS_PING_INTERVAL_MS);
}

export function setupWebSocketServer(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const heartbeatTimer = startHeartbeat(wss);

  wss.on("close", () => {
    clearInterval(heartbeatTimer);
  });

  wss.on("connection", async (ws, req) => {
    const token = extractWsToken(req.url ?? "");
    if (!token) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const auth = await authenticateWsToken(token);
    if (!auth.ok) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const userId = auth.userId;
    const tracked = ws as TrackedSocket;
    tracked.isAlive = true;
    tracked.on("pong", () => {
      tracked.isAlive = true;
    });

    const set = clients.get(userId) ?? new Set<WebSocket>();
    clients.set(userId, set);
    enforceConnectionCap(userId, set, ws);

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

/** Test-only introspection for connection hygiene assertions. */
export const __wsTestHooks = {
  getClientCount(userId: string): number {
    return clients.get(userId)?.size ?? 0;
  },
  clearClients(): void {
    clients.clear();
  },
};
