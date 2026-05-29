import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocketSync } from "./useWebSocketSync";
import { dispatchWebSocketEvent } from "../utils/dispatchWebSocketEvent";

vi.mock("./useAuth", () => ({
  useAuth: () => ({ token: "test-token", isAuthReady: true }),
}));

vi.mock("../utils/wsOrigins", () => ({
  getWsBaseUrl: () => "ws://127.0.0.1:5000/ws",
}));

vi.mock("../utils/dispatchWebSocketEvent", () => ({
  dispatchWebSocketEvent: vi.fn(),
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  close() {
    this.onclose?.();
  }
}

describe("useWebSocketSync", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("connects with bearer token and dispatches parsed frames", () => {
    renderHook(() => useWebSocketSync());

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.url).toContain("token=test-token");

    act(() => {
      MockWebSocket.instances[0]?.onmessage?.({
        data: JSON.stringify({ event: "agenda_changed" }),
      });
    });

    expect(dispatchWebSocketEvent).toHaveBeenCalledWith({ event: "agenda_changed" });
  });

  it("cleans up websocket on unmount", () => {
    const { unmount } = renderHook(() => useWebSocketSync());
    const ws = MockWebSocket.instances[0];
    const closeSpy = vi.spyOn(ws!, "close");

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
