export type ApiBaseUrlSource = "env" | "extra" | "hostUri" | "fallback";

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

function parseHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;

  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((part) => Number.isNaN(part) || part > 255)) {
    return false;
  }

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function isLocalOrPrivateApiHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost") return true;
  if (normalized.endsWith(".local")) return true;
  if (normalized === "::1" || normalized === "[::1]") return true;
  return isPrivateIpv4(normalized);
}

export function assertProductionSafeApiBaseUrl(
  apiBaseUrl: string,
  source: ApiBaseUrlSource,
): void {
  if (source === "hostUri" || source === "fallback") {
    throw new Error(
      `[app-worker] Production build requires EXPO_PUBLIC_API_BASE_URL or expo.extra.apiBaseUrl; resolved from ${source}.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error(`[app-worker] Invalid production API base URL: ${apiBaseUrl}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `[app-worker] Production API base URL must use https:// (got ${parsed.protocol}//${parsed.host}).`,
    );
  }

  if (isLocalOrPrivateApiHost(parsed.hostname)) {
    throw new Error(
      `[app-worker] Production API base URL cannot target localhost or private networks (${parsed.hostname}).`,
    );
  }
}
