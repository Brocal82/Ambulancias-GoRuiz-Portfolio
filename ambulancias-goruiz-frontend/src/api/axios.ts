import axios, { AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

// Sanea una baseURL: elimina '/api' final y la barra final
const sanitizeBase = (u?: string) =>
  (u || "")
    .replace(/\/+$/, "") // quita barras del final
    .replace(/\/api$/i, ""); // quita /api final si viene

const RAW = import.meta.env.VITE_API_URL;

// DEV: http://localhost:5000 (sin /api)
// PROD: same-origin ('') para que Netlify haga proxy /api/*
const DEV_BASE = sanitizeBase(RAW) || "http://localhost:5000";
const PROD_BASE = sanitizeBase(RAW) || ""; // same-origin en Netlify

const baseURL = import.meta.env.PROD ? PROD_BASE : DEV_BASE;

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

// --- Normalizador de URL: asegura el prefijo /api para rutas relativas ---
function ensureApiPrefix(config: InternalAxiosRequestConfig) {
  if (!config.url) return config;

  const url = config.url;

  // 1) Absolutas (http/https): no tocar
  if (/^https?:\/\//i.test(url)) return config;

  // 2) Ya correcto: /api/...
  if (url.startsWith("/api/")) return config;

  // 3) "api/..." (sin barra): añade la barra
  if (url.startsWith("api/")) {
    config.url = `/${url}`; // -> /api/...
    return config;
  }

  // 4) Empieza por "/" -> anteponer /api
  if (url.startsWith("/")) {
    config.url = `/api${url}`; // -> /api/...
    return config;
  }

  // 5) Relativa sin barra -> /api/...
  config.url = `/api/${url}`;
  return config;
}

// Interceptor request (normaliza URL + token + idioma)
axiosInstance.interceptors.request.use(
  (config) => {
    config = ensureApiPrefix(config);

    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers = AxiosHeaders.from(config.headers);
      (config.headers as AxiosHeaders).set("Authorization", `Bearer ${token}`);
    }

    const lang = (localStorage.getItem("lang") as string) || "es";
    config.headers = AxiosHeaders.from(config.headers);
    (config.headers as AxiosHeaders).set("Accept-Language", lang);

    return config;
  },
  (error) => Promise.reject(error),
);

// Defensa extra: si volviera HTML
axiosInstance.interceptors.response.use(
  (res) => {
    const ct = (res.headers?.["content-type"] || "").toLowerCase();
    if (
      ct.includes("text/html") ||
      (typeof res.data === "string" && res.data.trim().startsWith("<!doctype"))
    ) {
      throw new Error(
        "Respuesta HTML recibida. Revisa el prefijo /api o el proxy de Netlify.",
      );
    }
    return res;
  },
  (err) => {
    // On 401: session expired or token revoked mid-session.
    // Clear the session and redirect to login, unless we are already there
    // or the 401 came from the login endpoint itself.
    const status = err?.response?.status;
    const requestUrl = String(err?.config?.url ?? "");
    const isLoginEndpoint = requestUrl.includes("/users/login");
    const alreadyOnLogin = window.location.pathname === "/";

    if (status === 401 && !isLoginEndpoint && !alreadyOnLogin) {
      sessionStorage.clear();
      window.location.href = "/";
    }

    return Promise.reject(err);
  },
);

export default axiosInstance;
