import Constants from "expo-constants";

import {
  assertProductionSafeApiBaseUrl,
  normalizeApiBaseUrl,
  type ApiBaseUrlSource,
} from "./apiBaseUrlPolicy";

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

// Stable fallback when no env/extra is provided (development only).
const FALLBACK_API_BASE_URL = "http://192.168.178.33:5000/api";

function deriveDevApiBaseUrlFromExpoHostUri(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0]?.trim();
  if (!host) return null;
  return `http://${host}:5000/api`;
}

function resolveApiBaseUrl(): { apiBaseUrl: string; source: ApiBaseUrlSource } {
  const fromPublicEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromPublicEnv && fromPublicEnv.trim().length > 0) {
    return {
      apiBaseUrl: normalizeApiBaseUrl(fromPublicEnv),
      source: "env",
    };
  }

  const fromExpoExtra = extra.apiBaseUrl;
  if (fromExpoExtra && fromExpoExtra.trim().length > 0) {
    return {
      apiBaseUrl: normalizeApiBaseUrl(fromExpoExtra),
      source: "extra",
    };
  }

  const fromHostUri = deriveDevApiBaseUrlFromExpoHostUri();
  if (fromHostUri) {
    return {
      apiBaseUrl: normalizeApiBaseUrl(fromHostUri),
      source: "hostUri",
    };
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(FALLBACK_API_BASE_URL),
    source: "fallback",
  };
}

const resolved = resolveApiBaseUrl();
const apiBaseUrl = resolved.apiBaseUrl;

if (!__DEV__) {
  assertProductionSafeApiBaseUrl(apiBaseUrl, resolved.source);
}

// Derive WebSocket URL from apiBaseUrl:
// http://host:port/api  →  ws://host:port/ws
// https://host/api      →  wss://host/ws
const wsBaseUrl = apiBaseUrl
  .replace(/\/api$/, "/ws")
  .replace(/^https:/, "wss:")
  .replace(/^http:/, "ws:");

if (__DEV__) {
  // Keep a visible hint in Metro logs to detect wrong backend target quickly.
  console.info(`[app-worker] API base URL (${resolved.source}): ${apiBaseUrl}`);
}

export const ENV = {
  apiBaseUrl,
  wsBaseUrl,
};
