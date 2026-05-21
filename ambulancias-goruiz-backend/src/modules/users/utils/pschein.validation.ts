import path from "path";
import { validateSecureUploadFilename } from "../../../utils/secureUploadFilename";

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Strict YYYY-MM-DD calendar date (rejects 2025-02-30, etc.). */
export function parseStrictYmd(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!YMD_PATTERN.test(trimmed)) return null;

  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function validatePscheinExpiryYmd(
  value: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: "La fecha de caducidad del P-Schein es obligatoria" };
  }
  if (!parseStrictYmd(trimmed)) {
    return {
      ok: false,
      message: "La fecha de caducidad del P-Schein no es válida (use YYYY-MM-DD)",
    };
  }
  return { ok: true, normalized: trimmed };
}

const UPLOADS_PREFIX = "/uploads/";

/** Stored P-Schein path must be `/uploads/<safe-basename>.pdf`. */
export function validatePscheinStoredDocumentPath(
  storedPath: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const trimmed = storedPath.trim();
  if (!trimmed.startsWith(UPLOADS_PREFIX)) {
    return {
      ok: false,
      message: "La ruta del documento P-Schein no es válida",
    };
  }

  const basename = trimmed.slice(UPLOADS_PREFIX.length);
  if (!basename || basename.includes("/") || basename.includes("\\")) {
    return {
      ok: false,
      message: "La ruta del documento P-Schein no es válida",
    };
  }

  const secure = validateSecureUploadFilename(basename);
  if (!secure.ok) {
    return {
      ok: false,
      message: "La ruta del documento P-Schein no es válida",
    };
  }

  if (path.extname(secure.filename).toLowerCase() !== ".pdf") {
    return {
      ok: false,
      message: "El certificado P-Schein debe ser un archivo PDF",
    };
  }

  return { ok: true, normalized: `${UPLOADS_PREFIX}${secure.filename}` };
}
