const sanitizeBase = (u?: string) =>
  (u || "")
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

/** HTTP API origin without `/api` — used to derive `/ws` endpoint. */
export function getWsBaseUrl(): string {
  const RAW = import.meta.env.VITE_API_URL;
  const DEV_BASE = sanitizeBase(RAW) || "http://localhost:5000";
  const PROD_BASE = sanitizeBase(RAW) || "";
  const httpBase = import.meta.env.PROD ? PROD_BASE : DEV_BASE;
  const origin =
    httpBase ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

  const wsUrl = new URL(origin);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.pathname = "/ws";
  wsUrl.search = "";
  wsUrl.hash = "";
  return wsUrl.toString();
}
