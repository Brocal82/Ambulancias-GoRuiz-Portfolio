import { describe, it, expect } from "vitest";
import {
  collectSickLeaveDocumentUrls,
  isInternalUploadPath,
} from "./sickDocumentAccess";

describe("sick document secure access", () => {
  it("collects documentUrl and documents without duplicates", () => {
    expect(
      collectSickLeaveDocumentUrls({
        documentUrl: "/uploads/a.pdf",
        documents: ["/uploads/a.pdf", "/uploads/b.pdf"],
      }),
    ).toEqual(["/uploads/a.pdf", "/uploads/b.pdf"]);
  });

  it("accepts only internal /uploads paths for secure open", () => {
    expect(isInternalUploadPath("/uploads/foo.pdf")).toBe(true);
    expect(isInternalUploadPath("https://evil.example/x.pdf")).toBe(false);
  });
});
