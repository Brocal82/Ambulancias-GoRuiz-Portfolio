import { validateSickDocumentStoredPath } from "../modules/sick-leaves/utils/sick-document.validation";

describe("validateSickDocumentStoredPath", () => {
  it("accepts secure /uploads paths", () => {
    const result = validateSickDocumentStoredPath("/uploads/sick-doc-1234567890-123456789.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("/uploads/sick-doc-1234567890-123456789.pdf");
    }
  });

  it("rejects external URLs", () => {
    const result = validateSickDocumentStoredPath("https://evil.example.com/doc.pdf");
    expect(result.ok).toBe(false);
  });

  it("rejects traversal attempts", () => {
    const result = validateSickDocumentStoredPath("/uploads/../secret.pdf");
    expect(result.ok).toBe(false);
  });
});
