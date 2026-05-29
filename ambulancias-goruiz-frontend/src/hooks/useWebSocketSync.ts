import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { dispatchWebSocketEvent } from "../utils/dispatchWebSocketEvent";
import { getWsBaseUrl } from "../utils/wsOrigins";
import type { WsFrame } from "../utils/wsEvents";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Authenticated websocket listener: silent `{ event }` → local refetch emitters.
 */
export function useWebSocketSync(): void {
  const { token, isAuthReady } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      wsRef.current?.close();
      wsRef.current = null;
    };

    const scheduleReconnect = () => {
      if (!activeRef.current) return;
      clearReconnectTimer();
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (activeRef.current) connect();
      }, delay);
    };

    const connect = () => {
      if (!activeRef.current || !token) return;

      closeSocket();
      const wsUrl = `${getWsBaseUrl()}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = RECONNECT_BASE_MS;
      };

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(String(event.data)) as WsFrame;
          dispatchWebSocketEvent(frame);
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!activeRef.current) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    if (isAuthReady && token) {
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      connect();
    } else {
      clearReconnectTimer();
      closeSocket();
    }

    return () => {
      activeRef.current = false;
      clearReconnectTimer();
      closeSocket();
    };
  }, [token, isAuthReady]);
}
