import path from "path";
import {
  resolveUploadFilePath,
  validateSecureUploadFilename,
} from "../utils/secureUploadFilename";

describe("validateSecureUploadFilename", () => {
  it("accepts a normal multer-style basename", () => {
    expect(validateSecureUploadFilename("file-1234567890-123456789.pdf")).toEqual({
      ok: true,
      filename: "file-1234567890-123456789.pdf",
    });
  });

  it("rejects empty filenames", () => {
    expect(validateSecureUploadFilename("")).toEqual({
      ok: false,
      reason: "empty_filename",
    });
    expect(validateSecureUploadFilename("   ")).toEqual({
      ok: false,
      reason: "empty_filename",
    });
  });

  it("rejects dotfiles", () => {
    expect(validateSecureUploadFilename(".hidden.pdf")).toEqual({
      ok: false,
      reason: "dotfile",
    });
  });

  it("rejects path separators and parent directory segments", () => {
    expect(validateSecureUploadFilename("../secret.pdf")).toMatchObject({
      ok: false,
    });
    expect(validateSecureUploadFilename("subdir/secret.pdf")).toMatchObject({
      ok: false,
    });
    expect(validateSecureUploadFilename("subdir\\secret.pdf")).toMatchObject({
      ok: false,
    });
  });

  it("rejects encoded traversal attempts", () => {
    expect(validateSecureUploadFilename("..%2Fsecret.pdf")).toMatchObject({ ok: false });
    expect(validateSecureUploadFilename("secret%2Fother.pdf")).toMatchObject({
      ok: false,
      reason: "path_traversal",
    });
    expect(validateSecureUploadFilename("secret%00.pdf")).toMatchObject({
      ok: false,
      reason: "path_traversal",
    });
  });
});

describe("resolveUploadFilePath", () => {
  const uploadsRoot = path.join(__dirname, "../../uploads");

  it("resolves files inside the uploads root", () => {
    const result = resolveUploadFilePath(uploadsRoot, "owned.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filePath.startsWith(path.resolve(uploadsRoot))).toBe(true);
    }
  });

  it("rejects resolved paths outside the uploads root", () => {
    const result = resolveUploadFilePath(uploadsRoot, "..\\outside.pdf");
    expect(result).toEqual({ ok: false, reason: "path_outside_uploads_root" });
  });
});
