import fs from "fs/promises";
import path from "path";

const uploadsDir = path.join(__dirname, "../../uploads");

/**
 * Removes Multer temp files from disk (best-effort).
 * Used when validation or tenant checks fail after upload.
 */
export async function unlinkMulterFiles(
  files: Express.Multer.File[] | undefined,
): Promise<void> {
  if (!files?.length) return;
  for (const file of files) {
    const filePath =
      typeof file.path === "string" && file.path.trim() !== ""
        ? file.path
        : typeof file.filename === "string" && file.filename.trim() !== ""
          ? path.join(uploadsDir, path.basename(file.filename))
          : "";
    if (!filePath) continue;
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : "";
      if (code !== "ENOENT") {
        console.warn("[upload] no se pudo borrar fichero temporal:", filePath, err);
      }
    }
  }
}
