const PUBLIC_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export function isVerifiedPublicImageFilename(filename: string): boolean {
  const lower = filename.trim().toLowerCase();
  return PUBLIC_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isVerifiedPublicImageMeta(meta: {
  mimetype?: string;
  originalName?: string;
}): boolean {
  const mime = (meta.mimetype ?? "").trim().toLowerCase();
  if (mime.startsWith("image/")) {
    if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
      return true;
    }
  }
  const name = (meta.originalName ?? "").trim();
  if (!name) return false;
  return isVerifiedPublicImageFilename(name);
}

/** PDFs and unknown types must use authenticated /api/files/:filename. */
export function shouldUseAuthenticatedFileRoute(meta?: {
  mimetype?: string;
  originalName?: string;
}): boolean {
  if (!meta) return true;
  if ((meta.mimetype ?? "").trim().toLowerCase() === "application/pdf") return true;
  if ((meta.originalName ?? "").trim().toLowerCase().endsWith(".pdf")) return true;
  if (isVerifiedPublicImageMeta(meta)) return false;
  return true;
}

export function buildPublicUploadCandidates(rawUrl: string, apiBaseUrl: string): string[] {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return [rawUrl];
  }

  const normalizedPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const apiBase = apiBaseUrl.replace(/\/+$/, "");
  const apiOrigin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

  return [`${apiOrigin}${normalizedPath}`, `${apiBase}${normalizedPath}`];
}
