import {
  parseStrictYmd,
  validatePscheinExpiryYmd,
  validatePscheinStoredDocumentPath,
} from "../modules/users/utils/pschein.validation";

describe("pschein.validation", () => {
  describe("parseStrictYmd", () => {
    it("accepts valid YYYY-MM-DD", () => {
      expect(parseStrictYmd("2030-06-15")).toBeInstanceOf(Date);
    });

    it("rejects invalid calendar dates", () => {
      expect(parseStrictYmd("2025-02-30")).toBeNull();
      expect(parseStrictYmd("2025-13-01")).toBeNull();
    });

    it("rejects non-YYYY-MM-DD formats", () => {
      expect(parseStrictYmd("15/06/2030")).toBeNull();
      expect(parseStrictYmd("2030-6-15")).toBeNull();
      expect(parseStrictYmd("not-a-date")).toBeNull();
    });
  });

  describe("validatePscheinExpiryYmd", () => {
    it("normalizes valid expiry", () => {
      const result = validatePscheinExpiryYmd(" 2031-12-31 ");
      expect(result).toEqual({ ok: true, normalized: "2031-12-31" });
    });

    it("rejects empty and invalid values", () => {
      expect(validatePscheinExpiryYmd("").ok).toBe(false);
      expect(validatePscheinExpiryYmd("2025-02-30").ok).toBe(false);
    });
  });

  describe("validatePscheinStoredDocumentPath", () => {
    it("accepts /uploads/<basename>.pdf", () => {
      const result = validatePscheinStoredDocumentPath(
        "/uploads/pschein-123456789-987654321.pdf",
      );
      expect(result.ok).toBe(true);
    });

    it("rejects traversal and non-pdf paths", () => {
      expect(
        validatePscheinStoredDocumentPath("/uploads/../secret.pdf").ok,
      ).toBe(false);
      expect(
        validatePscheinStoredDocumentPath("/uploads/image.jpg").ok,
      ).toBe(false);
      expect(validatePscheinStoredDocumentPath("uploads/x.pdf").ok).toBe(false);
    });
  });
});
