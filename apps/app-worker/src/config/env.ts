import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

// Usa la IP real de tu backend cuando pruebes en movil/tablet fisicos.
const FALLBACK_API_BASE_URL = "http://192.168.178.33:5000/api";

export const ENV = {
  apiBaseUrl: extra.apiBaseUrl ?? FALLBACK_API_BASE_URL,
};
