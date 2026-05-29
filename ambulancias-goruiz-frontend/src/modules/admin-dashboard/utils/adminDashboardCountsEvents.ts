const ADMIN_DASHBOARD_COUNTS_REFRESH = "admin-dashboard-counts-refresh";

/** Coalesced admin dashboard counter refresh signal (WS + cross-tab). */
export function emitAdminDashboardCountsRefresh(): void {
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_DASHBOARD_COUNTS_REFRESH));
  } catch {
    /* noop */
  }
}

export function subscribeAdminDashboardCountsRefresh(handler: () => void): () => void {
  window.addEventListener(ADMIN_DASHBOARD_COUNTS_REFRESH, handler);
  return () =>
    window.removeEventListener(ADMIN_DASHBOARD_COUNTS_REFRESH, handler);
}
