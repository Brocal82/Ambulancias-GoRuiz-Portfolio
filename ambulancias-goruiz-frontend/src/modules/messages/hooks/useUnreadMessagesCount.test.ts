import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useUnreadMessagesCount } from "./useUnreadMessagesCount";
import * as api from "../domain/api";
import * as useMessagesChangedModule from "./useMessagesChanged";
import type { MessagesChangedDetail } from "../utils/messageEvents";

vi.mock("../domain/api", () => ({
  getMyMessages: vi.fn(),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ token: "worker-token" }),
}));

vi.mock("./useMessagesChanged", () => ({
  useMessagesChanged: vi.fn(),
}));

describe("useUnreadMessagesCount", () => {
  beforeEach(() => {
    vi.mocked(api.getMyMessages).mockReset();
    vi.mocked(useMessagesChangedModule.useMessagesChanged).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skip=true no llama a la API y devuelve count 0", async () => {
    const { result } = renderHook(() =>
      useUnreadMessagesCount({ skip: true, pollMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.count).toBe(0);
      expect(result.current.loading).toBe(false);
    });

    expect(api.getMyMessages).not.toHaveBeenCalled();
  });

  it("actualiza count con la longitud de mensajes no leídos", async () => {
    vi.mocked(api.getMyMessages).mockResolvedValue([
      { _id: "1" } as never,
      { _id: "2" } as never,
    ]);

    const { result } = renderHook(() =>
      useUnreadMessagesCount({ pollMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.count).toBe(2);
    });
  });

  it("limpia intervalo de polling al desmontar", async () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    vi.mocked(api.getMyMessages).mockResolvedValue([]);

    const { unmount } = renderHook(() =>
      useUnreadMessagesCount({ pollMs: 1000 }),
    );

    await waitFor(() => {
      expect(api.getMyMessages).toHaveBeenCalled();
    });

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("refresca al recuperar foco y visibilidad", async () => {
    vi.mocked(api.getMyMessages).mockResolvedValue([]);

    renderHook(() => useUnreadMessagesCount({ pollMs: 0 }));

    await waitFor(() => {
      expect(api.getMyMessages).toHaveBeenCalled();
    });

    vi.mocked(api.getMyMessages).mockClear();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(vi.mocked(api.getMyMessages).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("useMessagesChanged dispara refresh del hook", async () => {
    let changedHandler: ((detail: MessagesChangedDetail) => void) | undefined;
    vi.mocked(useMessagesChangedModule.useMessagesChanged).mockImplementation((handler) => {
      changedHandler = handler;
    });
    vi.mocked(api.getMyMessages).mockResolvedValue([{ _id: "1" } as never]);

    const { result } = renderHook(() =>
      useUnreadMessagesCount({ pollMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.count).toBe(1);
    });

    vi.mocked(api.getMyMessages).mockResolvedValue([
      { _id: "1" } as never,
      { _id: "2" } as never,
    ]);

    act(() => {
      changedHandler?.({});
    });

    await waitFor(() => {
      expect(result.current.count).toBe(2);
    });
  });
});
