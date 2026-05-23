import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUnreadMessagesCount } from "./useUnreadMessagesCount";
import * as api from "../domain/api";

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
});
