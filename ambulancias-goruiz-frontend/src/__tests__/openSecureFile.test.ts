import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

import axiosInstance from "../api/axios";
import { openSecureFile } from "../utils/openSecureFile";

describe("openSecureFile", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: new Blob([], { type: "application/pdf" }),
    });
  });

  it("requests /api/files/foo.pdf with responseType blob for /uploads/foo.pdf", async () => {
    await openSecureFile("/uploads/foo.pdf");
    expect(axiosInstance.get).toHaveBeenCalledWith("/api/files/foo.pdf", {
      responseType: "blob",
    });
  });
});
