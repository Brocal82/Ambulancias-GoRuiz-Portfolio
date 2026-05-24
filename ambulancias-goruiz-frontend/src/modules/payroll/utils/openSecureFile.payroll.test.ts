import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

import axiosInstance from "../../../api/axios";
import { openSecureFile } from "../../../utils/openSecureFile";

describe("openSecureFile payroll usage", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: new Blob([], { type: "application/pdf" }),
    });
  });

  it("opens payroll PDF via /api/files/:filename (never /uploads direct)", async () => {
    await openSecureFile("nomina-2025-03.pdf");
    expect(axiosInstance.get).toHaveBeenCalledWith("/api/files/nomina-2025-03.pdf", {
      responseType: "blob",
    });
  });

  it("normalizes /uploads/ prefix to secure API path", async () => {
    await openSecureFile("/uploads/nomina-2025-03.pdf");
    expect(axiosInstance.get).toHaveBeenCalledWith("/api/files/nomina-2025-03.pdf", {
      responseType: "blob",
    });
  });
});
