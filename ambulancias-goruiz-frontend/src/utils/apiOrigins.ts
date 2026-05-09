export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export function buildImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  // External absolute URL (not localhost) — return as-is (CDN, Gravatar, etc.)
  if (/^https?:\/\//i.test(pathOrUrl) && !/localhost:5000/i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  // For absolute localhost URLs extract just the pathname
  let relative = pathOrUrl;
  if (/^https?:\/\//i.test(relative)) {
    try {
      relative = new URL(relative).pathname;
    } catch {
      return pathOrUrl;
    }
  }
  const normalized = relative.startsWith("/uploads")
    ? relative
    : `/uploads/${relative.replace(/^\//, "")}`;
  // Dev: use relative path so the Vite proxy forwards to the backend
  if (import.meta.env.DEV) return normalized;
  return `${API_ORIGIN}${normalized}`;
}
