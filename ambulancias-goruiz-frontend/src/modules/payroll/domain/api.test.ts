import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  listPayrollDocuments,
  uploadPayrollDocument,
  uploadPayrollBatch,
  assignPayrollDocument,
  invalidatePayrollDocument,
  listMyPayrollDocuments,
  checkPayrollCoverage,
  getPayrollCoverageYearSummary,
} from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("payroll domain api", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it("listPayrollDocuments usa GET /payroll", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await listPayrollDocuments();
    expect(api.get).toHaveBeenCalledWith("/payroll");
  });

  it("listMyPayrollDocuments usa GET /payroll/mine", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await listMyPayrollDocuments();
    expect(api.get).toHaveBeenCalledWith("/payroll/mine");
  });

  it("uploadPayrollDocument envía FormData a /payroll/upload", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    await uploadPayrollDocument({ file, year: 2025, month: 3 });
    expect(api.post).toHaveBeenCalledWith("/payroll/upload", expect.any(FormData));
  });

  it("uploadPayrollBatch envía FormData a /payroll/upload/batch", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { summary: {}, results: [] } });
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    await uploadPayrollBatch({ files: [file], year: 2025, month: 3 });
    expect(api.post).toHaveBeenCalledWith(
      "/payroll/upload/batch",
      expect.any(FormData),
    );
  });

  it("assignPayrollDocument usa PATCH /payroll/:id/assign", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    await assignPayrollDocument("doc1", "worker1");
    expect(api.patch).toHaveBeenCalledWith("/payroll/doc1/assign", {
      workerId: "worker1",
    });
  });

  it("invalidatePayrollDocument usa PATCH /payroll/:id/invalidate", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { payrollId: "doc1" } });
    await invalidatePayrollDocument("doc1");
    expect(api.patch).toHaveBeenCalledWith("/payroll/doc1/invalidate");
  });

  it("checkPayrollCoverage usa GET /payroll/missing con params", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    await checkPayrollCoverage(2025, 4);
    expect(api.get).toHaveBeenCalledWith("/payroll/missing", {
      params: { year: 2025, month: 4 },
    });
  });

  it("getPayrollCoverageYearSummary usa GET /payroll/coverage/year", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    await getPayrollCoverageYearSummary(2025);
    expect(api.get).toHaveBeenCalledWith("/payroll/coverage/year", {
      params: { year: 2025 },
    });
  });
});
