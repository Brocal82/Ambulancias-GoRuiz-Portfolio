import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  getMonthlyPraemienSummary,
  getPraemienMonthlyHistory,
} from "./api";
import { saveMonthlyPraemie } from "./historyApi";
import {
  getMyManualDailyEntriesForMonth,
  getAdminManualPraemieDayWorkdaySummaries,
  postAdminManualDailyApprove,
  postAdminManualDailyReject,
  postAdminManualDailyReopen,
} from "./manualDailyApi";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("praemien domain api", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.put).mockReset();
  });

  it("getMonthlyPraemienSummary usa GET /praemien/monthly-summary", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { monthlyData: [], averagePatients: 0 },
    });
    await getMonthlyPraemienSummary();
    expect(api.get).toHaveBeenCalledWith("/praemien/monthly-summary", {
      params: undefined,
    });
  });

  it("getMonthlyPraemienSummary pasa userId como query para admin", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { monthlyData: [], averagePatients: 0 },
    });
    await getMonthlyPraemienSummary("uid1");
    expect(api.get).toHaveBeenCalledWith("/praemien/monthly-summary", {
      params: { userId: "uid1" },
    });
  });

  it("getPraemienMonthlyHistory usa GET /praemien/monthly-history", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await getPraemienMonthlyHistory();
    expect(api.get).toHaveBeenCalledWith("/praemien/monthly-history", {
      params: undefined,
    });
  });

  it("saveMonthlyPraemie usa POST /praemien/save-monthly", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: "ok" } });
    await saveMonthlyPraemie("token", {
      month: "2033-04",
      averagePatients: 8,
      premieLevel: "B",
    });
    expect(api.post).toHaveBeenCalledWith(
      "/praemien/save-monthly",
      {
        month: "2033-04",
        averagePatients: 8,
        premieLevel: "B",
      },
      expect.objectContaining({
        headers: { Authorization: "Bearer token" },
      }),
    );
  });

  it("manual daily month usa GET /praemien/manual-daily/month", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await getMyManualDailyEntriesForMonth(2026, 5);
    expect(api.get).toHaveBeenCalledWith("/praemien/manual-daily/month", {
      params: { year: 2026, month: 5 },
    });
  });

  it("admin day workday summaries usa GET manual-daily/admin/day-workday-summaries", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { summaries: [] } });
    await getAdminManualPraemieDayWorkdaySummaries("u1", "2026-05-01");
    expect(api.get).toHaveBeenCalledWith(
      "/praemien/manual-daily/admin/day-workday-summaries",
      { params: { userId: "u1", date: "2026-05-01" } },
    );
  });

  it("admin review transitions usan POST manual-daily/admin/*", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    await postAdminManualDailyApprove({ userId: "u1", date: "2026-05-01" });
    await postAdminManualDailyReject({
      userId: "u1",
      date: "2026-05-01",
      reason: "x",
    });
    await postAdminManualDailyReopen({ userId: "u1", date: "2026-05-01" });

    expect(api.post).toHaveBeenCalledWith(
      "/praemien/manual-daily/admin/approve",
      { userId: "u1", date: "2026-05-01" },
    );
    expect(api.post).toHaveBeenCalledWith(
      "/praemien/manual-daily/admin/reject",
      { userId: "u1", date: "2026-05-01", reason: "x" },
    );
    expect(api.post).toHaveBeenCalledWith(
      "/praemien/manual-daily/admin/reopen",
      { userId: "u1", date: "2026-05-01" },
    );
  });
});
