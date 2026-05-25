import path from "path";
import { validateSecureUploadFilename } from "../../../utils/secureUploadFilename";

const UPLOADS_PREFIX = "/uploads/";
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

/** Stored sick-leave document path must be `/uploads/<safe-basename>`. */
export function validateSickDocumentStoredPath(
  storedPath: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const trimmed = storedPath.trim().replace(/\\/g, "/");
  if (!trimmed.startsWith(UPLOADS_PREFIX)) {
    return {
      ok: false,
      message: "La ruta del documento no es v\u00E1lida",
    };
  }

  const basename = trimmed.slice(UPLOADS_PREFIX.length);
  if (!basename || basename.includes("/") || basename.includes("\\")) {
    return {
      ok: false,
      message: "La ruta del documento no es v\u00E1lida",
    };
  }

  const secure = validateSecureUploadFilename(basename);
  if (!secure.ok) {
    return {
      ok: false,
      message: "La ruta del documento no es v\u00E1lida",
    };
  }

  const ext = path.extname(secure.filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: "Tipo de documento no permitido",
    };
  }

  return { ok: true, normalized: `${UPLOADS_PREFIX}${secure.filename}` };
}
