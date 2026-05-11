import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

// Stable fallback when no env/extra is provided.
const FALLBACK_API_BASE_URL = "http://192.168.178.33:5000/api";

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

function deriveDevApiBaseUrlFromExpoHostUri(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0]?.trim();
  if (!host) return null;
  return `http://${host}:5000/api`;
}

function resolveApiBaseUrl(): string {
  const fromPublicEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromPublicEnv && fromPublicEnv.trim().length > 0) {
    return normalizeApiBaseUrl(fromPublicEnv);
  }

  const fromExpoExtra = extra.apiBaseUrl;
  if (fromExpoExtra && fromExpoExtra.trim().length > 0) {
    return normalizeApiBaseUrl(fromExpoExtra);
  }

  const fromHostUri = deriveDevApiBaseUrlFromExpoHostUri();
  if (fromHostUri) {
    return normalizeApiBaseUrl(fromHostUri);
  }

  return normalizeApiBaseUrl(FALLBACK_API_BASE_URL);
}

const apiBaseUrl = resolveApiBaseUrl();

// Derive WebSocket URL from apiBaseUrl:
// http://host:port/api  →  ws://host:port/ws
// https://host/api      →  wss://host/ws
const wsBaseUrl = apiBaseUrl
  .replace(/\/api$/, "/ws")
  .replace(/^https:/, "wss:")
  .replace(/^http:/, "ws:");

if (__DEV__) {
  // Keep a visible hint in Metro logs to detect wrong backend target quickly.
  console.info(`[app-worker] API base URL: ${apiBaseUrl}`);
}

export const ENV = {
  apiBaseUrl,
  wsBaseUrl,
};
