import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAdminAppointmentsSync } from "./useAdminAppointmentsSync";
import * as api from "../domain/api";

vi.mock("../domain/api", () => ({
  getOpenAppointments: vi.fn(),
  getCalendarAppointments: vi.fn(),
}));

vi.mock("./useAppointmentsChanged", () => ({
  useAppointmentsChanged: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: { error: vi.fn() },
  getApiErrorMessage: vi.fn((_e: unknown, keys: string[]) => keys[0]),
}));

describe("useAdminAppointmentsSync", () => {
  beforeEach(() => {
    vi.mocked(api.getOpenAppointments).mockReset();
    vi.mocked(api.getCalendarAppointments).mockReset();
  });

  it("expone loadingPending y loadingConfirmed en carga inicial", async () => {
    vi.mocked(api.getOpenAppointments).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    );
    vi.mocked(api.getCalendarAppointments).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    );

    const { result } = renderHook(() =>
      useAdminAppointmentsSync({ token: "tok", year: 2030 }),
    );

    expect(result.current.loadingPending).toBe(true);
    expect(result.current.loadingConfirmed).toBe(true);

    await waitFor(() => {
      expect(result.current.loadingPending).toBe(false);
      expect(result.current.loadingConfirmed).toBe(false);
    });
  });

  it("carga open y calendar en paralelo con token", async () => {
    vi.mocked(api.getOpenAppointments).mockResolvedValue([
      { _id: "p1", reason: "R", details: "D", status: "pending", proposedSlots: [], workerId: "w1", createdAt: "", updatedAt: "" },
    ]);
    vi.mocked(api.getCalendarAppointments).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useAdminAppointmentsSync({ token: "tok", year: 2030 }),
    );

    await waitFor(() => {
      expect(result.current.pending).toHaveLength(1);
      expect(result.current.loadingPending).toBe(false);
    });

    expect(vi.mocked(api.getOpenAppointments)).toHaveBeenCalledWith("tok");
    expect(vi.mocked(api.getCalendarAppointments)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.getCalendarAppointments).mock.calls[0]?.[2]).toBe("tok");
  });

  it("finaliza loading cuando open falla", async () => {
    vi.mocked(api.getOpenAppointments).mockRejectedValue(new Error("network"));
    vi.mocked(api.getCalendarAppointments).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useAdminAppointmentsSync({ token: "tok", year: 2030 }),
    );

    await waitFor(() => {
      expect(result.current.loadingPending).toBe(false);
      expect(result.current.loadingConfirmed).toBe(false);
    });
  });

  it("no fetch si token es null", async () => {
    const { result } = renderHook(() =>
      useAdminAppointmentsSync({ token: null, year: 2030 }),
    );

    expect(result.current.loadingPending).toBe(false);
    expect(result.current.loadingConfirmed).toBe(false);
    expect(api.getOpenAppointments).not.toHaveBeenCalled();
    expect(api.getCalendarAppointments).not.toHaveBeenCalled();
  });
});
