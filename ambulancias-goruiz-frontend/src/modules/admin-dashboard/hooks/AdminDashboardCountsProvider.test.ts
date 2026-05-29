import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { emitAdminDashboardCountsRefresh } from "../utils/adminDashboardCountsEvents";

describe("AdminDashboardCountsProvider coalescing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces burst refresh signals into a single scheduled fetch window", () => {
    const scheduled: number[] = [];
    const handler = () => scheduled.push(Date.now());

    window.addEventListener("admin-dashboard-counts-refresh", handler);

    emitAdminDashboardCountsRefresh();
    emitAdminDashboardCountsRefresh();
    emitAdminDashboardCountsRefresh();

    expect(scheduled).toHaveLength(3);

    window.removeEventListener("admin-dashboard-counts-refresh", handler);
  });
});
