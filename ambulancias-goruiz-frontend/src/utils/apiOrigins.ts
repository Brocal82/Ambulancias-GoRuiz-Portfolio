export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export function buildImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  // External absolute URL (not localhost) — return as-is (CDN, Gravatar, etc.)
  if (/^https?:\/\//i.test(pathOrUrl) && !/localhost:5000/i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  // For localhost absolute URLs extract just the pathname to avoid double-wrapping
  // when API_ORIGIN equals the stored host (replace would be a no-op).
  let relative = pathOrUrl;
  if (/^https?:\/\//i.test(relative)) {
    try {
      relative = new URL(relative).pathname;
    } catch {
      return pathOrUrl;
    }
  }
  if (relative.startsWith("/uploads")) return `${API_ORIGIN}${relative}`;
  return `${API_ORIGIN}/uploads/${relative.replace(/^\//, "")}`;
}
