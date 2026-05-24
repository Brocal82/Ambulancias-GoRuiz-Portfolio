import { describe, it, expect } from "vitest";
import {
  filterPdfFiles,
  hasPdfExtension,
  isAcknowledgmentUploadEnabled,
  isPdfFile,
} from "./uploadValidation";

describe("documents uploadValidation", () => {
  it("hasPdfExtension detecta .pdf insensible a mayúsculas", () => {
    expect(hasPdfExtension("doc.PDF")).toBe(true);
    expect(hasPdfExtension("doc.txt")).toBe(false);
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
    expect(result.valid[0].name).toBe("ok.pdf");
  });

  it("isAcknowledgmentUploadEnabled solo con un archivo", () => {
    expect(isAcknowledgmentUploadEnabled(0)).toBe(false);
    expect(isAcknowledgmentUploadEnabled(1)).toBe(true);
    expect(isAcknowledgmentUploadEnabled(2)).toBe(false);
  });
});
