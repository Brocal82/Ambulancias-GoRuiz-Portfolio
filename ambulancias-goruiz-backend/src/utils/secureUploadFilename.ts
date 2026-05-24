import path from "path";

const ENCODED_TRAVERSAL_PATTERN = /%(?:2f|5c|2e2e|00)/i;

export type SecureUploadFilenameResult =
  | { ok: true; filename: string }
  | { ok: false; reason: string };

function hasPathSeparator(value: string): boolean {
  return /[/\\]/.test(value);
}

function hasParentDirectorySegment(value: string): boolean {
  return value === ".." || value.includes("..");
}

function hasEncodedTraversalAttempt(value: string): boolean {
  return ENCODED_TRAVERSAL_PATTERN.test(value);
}

function decodeFilenameCandidate(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Sanitizes a user-provided basename stem for multer disk storage.
 * Keeps alphanumerics, dots, hyphens, and underscores; replaces other chars.
 * Never returns empty or a dotfile prefix.
 */
export function sanitizeMulterBasename(raw: string): string {
  const withoutPath = path.basename(raw.replace(/\\/g, "/"));
  let cleaned = withoutPath
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+/, "")
    .replace(/_+$/, "");

  if (!cleaned || cleaned.startsWith(".")) {
    cleaned = "upload";
  }

  return cleaned;
}

/**
 * Validates a single-segment upload basename for GET /api/files/:filename.
 * Rejects traversal, path separators, dotfiles, and encoded escape attempts.
 */
export function validateSecureUploadFilename(raw: string): SecureUploadFilenameResult {
  if (!raw || raw.trim() === "") {
    return { ok: false, reason: "empty_filename" };
  }

  if (raw !== raw.trim()) {
    return { ok: false, reason: "invalid_filename" };
  }

  if (raw.startsWith(".")) {
    return { ok: false, reason: "dotfile" };
  }

  if (
    hasPathSeparator(raw) ||
    hasParentDirectorySegment(raw) ||
    hasEncodedTraversalAttempt(raw)
  ) {
    return { ok: false, reason: "path_traversal" };
  }

  const decoded = decodeFilenameCandidate(raw);
  if (decoded === null) {
    return { ok: false, reason: "invalid_encoding" };
  }

  if (
    decoded !== raw &&
    (hasPathSeparator(decoded) ||
      hasParentDirectorySegment(decoded) ||
      decoded.startsWith(".") ||
      hasEncodedTraversalAttempt(decoded))
  ) {
    return { ok: false, reason: "path_traversal" };
  }

  const filename = path.basename(raw);
  if (!filename || filename !== raw) {
    return { ok: false, reason: "invalid_filename" };
  }

  return { ok: true, filename };
}

/**
 * Ensures a resolved file path stays inside the uploads root directory.
 */
export function resolveUploadFilePath(
  uploadsRoot: string,
  filename: string,
): { ok: true; filePath: string } | { ok: false; reason: string } {
  const resolvedRoot = path.resolve(uploadsRoot);
  const filePath = path.resolve(resolvedRoot, filename);
  const relative = path.relative(resolvedRoot, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, reason: "path_outside_uploads_root" };
  }

  return { ok: true, filePath };
}
