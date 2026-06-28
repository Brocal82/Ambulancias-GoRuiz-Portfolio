import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  scanAbsenceInconsistencies,
  repairAbsenceInconsistencies,
} from "./absenceCleanupApi";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const TOKEN = "test-token";

describe("absenceCleanupApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scanAbsenceInconsistencies", () => {
    it("calls GET /operational-recovery/absence-cleanup with auth header", async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { inconsistencies: [], scannedAt: "2026-06-28T10:00:00.000Z" },
      });

      const result = await scanAbsenceInconsistencies(TOKEN);

      expect(api.get).toHaveBeenCalledWith(
        "/operational-recovery/absence-cleanup",
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
          params: {},
        },
      );
      expect(result.inconsistencies).toEqual([]);
      expect(result.scannedAt).toBe("2026-06-28T10:00:00.000Z");
    });

    it("passes fromDate and toDate as query params when provided", async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { inconsistencies: [], scannedAt: "2026-06-28T10:00:00.000Z" },
      });

      await scanAbsenceInconsistencies(TOKEN, {
        fromDate: "2026-06-01",
        toDate: "2026-06-30",
      });

      expect(api.get).toHaveBeenCalledWith(
        "/operational-recovery/absence-cleanup",
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
          params: { fromDate: "2026-06-01", toDate: "2026-06-30" },
        },
      );
    });

    it("omits undefined date params from query", async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { inconsistencies: [], scannedAt: "2026-06-28T10:00:00.000Z" },
      });

      await scanAbsenceInconsistencies(TOKEN, { fromDate: "2026-06-01" });

      const call = vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, string> };
      expect(call.params).toEqual({ fromDate: "2026-06-01" });
      expect(call.params.toDate).toBeUndefined();
    });

    it("propagates errors from the API", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
      await expect(scanAbsenceInconsistencies(TOKEN)).rejects.toThrow("Network error");
    });
  });

  describe("repairAbsenceInconsistencies", () => {
    it("calls POST /operational-recovery/absence-cleanup/repair with items", async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: { results: [{ repairFailed: false, assignmentsTouched: 1, dienstsTouched: 1, alreadyClean: false, remainingInconsistencies: [] }] },
      });

      const items = [
        {
          workerId: "507f1f77bcf86cd799439011",
          absenceType: "vacation" as const,
          absenceId: "507f1f77bcf86cd799439012",
        },
      ];

      const result = await repairAbsenceInconsistencies(TOKEN, items);

      expect(api.post).toHaveBeenCalledWith(
        "/operational-recovery/absence-cleanup/repair",
        { items },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      expect(result.results).toHaveLength(1);
      expect(result.results[0].repairFailed).toBe(false);
    });

    it("propagates errors from the repair endpoint", async () => {
      vi.mocked(api.post).mockRejectedValue(new Error("Repair failed"));
      await expect(
        repairAbsenceInconsistencies(TOKEN, [
          {
            workerId: "507f1f77bcf86cd799439011",
            absenceType: "vacation",
            absenceId: "507f1f77bcf86cd799439012",
          },
        ]),
      ).rejects.toThrow("Repair failed");
    });
  });
});
