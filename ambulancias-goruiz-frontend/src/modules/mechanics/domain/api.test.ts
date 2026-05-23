import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  reportIssue,
  deleteIssueReport,
  markIssueSeen,
  getIssuesOpenCount,
  listMechanicsWorkOrders,
} from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("mechanics domain api", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it("reportIssue sin fotos usa JSON POST", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    await reportIssue({
      assignmentId: "a".repeat(24),
      dienstNumber: 1,
      date: "2030-01-01",
      startTime: "08:00",
      endTime: "16:00",
      team: "T1",
      ambulanceNumber: "7",
      finalKm: 100,
      timestamp: new Date().toISOString(),
      issueText: "Fallo motor",
      driver: "d".repeat(24),
      medic: "m".repeat(24),
    });
    expect(api.post).toHaveBeenCalledWith(
      "/mechanics/report-issue",
      expect.objectContaining({ issueText: "Fallo motor" }),
    );
  });

  it("reportIssue con fotos usa multipart FormData", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await reportIssue(
      {
        assignmentId: "a".repeat(24),
        dienstNumber: 1,
        date: "2030-01-01",
        startTime: "08:00",
        endTime: "16:00",
        team: "T1",
        ambulanceNumber: "7",
        finalKm: 100,
        timestamp: new Date().toISOString(),
        issueText: "Con foto",
        driver: "d".repeat(24),
        medic: "m".repeat(24),
      },
      [file],
    );
    const [, body] = vi.mocked(api.post).mock.calls[0];
    expect(body).toBeInstanceOf(FormData);
  });

  it("markIssueSeen usa PATCH sin body", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { _id: "i1", isSeen: true } });
    await markIssueSeen("issue-id");
    expect(api.patch).toHaveBeenCalledWith("/mechanics/issues/issue-id/seen", null);
  });

  it("deleteIssueReport usa DELETE", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    await deleteIssueReport("issue-id");
    expect(api.delete).toHaveBeenCalledWith("/mechanics/issues/issue-id");
  });

  it("getIssuesOpenCount usa status open", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 2 } });
    const count = await getIssuesOpenCount();
    expect(count).toBe(2);
    expect(api.get).toHaveBeenCalledWith("/mechanics/issues/count", {
      params: { status: "open" },
    });
  });

  it("listMechanicsWorkOrders pasa ambulanceId en query cuando se indica", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    const ambId = "b".repeat(24);
    await listMechanicsWorkOrders(ambId);
    expect(api.get).toHaveBeenCalledWith("/mechanics/work-orders", {
      params: { ambulanceId: ambId },
    });
  });
});
