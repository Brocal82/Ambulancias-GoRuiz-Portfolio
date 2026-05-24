import { describe, it, expect } from "vitest";
import {
  filterPdfFiles,
  formatPayrollReplacementMessage,
  hasPdfExtension,
  isPdfFile,
} from "./uploadValidation";

describe("payroll uploadValidation", () => {
  it("hasPdfExtension detecta .pdf insensible a mayúsculas", () => {
    expect(hasPdfExtension("nomina.PDF")).toBe(true);
    expect(hasPdfExtension("nomina.txt")).toBe(false);
  });

  it("isPdfFile acepta MIME application/pdf", () => {
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    expect(isPdfFile(file)).toBe(true);
  });

  it("isPdfFile rechaza imágenes", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    expect(isPdfFile(file)).toBe(false);
  });

  it("filterPdfFiles separa válidos y rechazados", () => {
    const pdf = new File(["x"], "ok.pdf", { type: "application/pdf" });
    const img = new File(["x"], "bad.png", { type: "image/png" });
    const result = filterPdfFiles([pdf, img]);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });

  it("formatPayrollReplacementMessage incluye nombre original", () => {
    expect(formatPayrollReplacementMessage("enero.pdf")).toContain("enero.pdf");
  });
});
