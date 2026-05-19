// src/components/RequireModule.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useModules } from "../hooks/useModules";
import { homePathForRole } from "../utils/roleHomePath";

interface RequireModuleProps {
  /** Canonical module key, e.g. "hospitals", "vacation", "scheduling". */
  name: string;
}

/**
 * Route guard that blocks access to routes belonging to a disabled module.
 *
 * Usage (in App.tsx, wrapping a route or a group of routes):
 *
 *   <Route element={<RequireModule name="hospitals" />}>
 *     <Route path="/admin/hospitals" element={<AdminHospitalsPage />} />
 *   </Route>
 *
 * Behaviour:
 *   - While auth is not ready: shows a loading indicator (same as RequireRole).
 *   - While enabledModules is loading (null) and user is not superadmin:
 *     shows a loading indicator to prevent false negatives on first render.
 *   - If module is disabled: redirects to the user's home dashboard.
 *   - If module is enabled (or user is superadmin): renders the Outlet.
 */
export default function RequireModule({ name }: RequireModuleProps) {
  const { isAuthReady, role } = useAuth();
  const { hasModule, enabledModules } = useModules();
  const { t } = useTranslation();

  if (!isAuthReady) {
    return <div className="p-4">{t("guards.loadingSession")}</div>;
  }

  // While modules are still loading, show spinner to prevent a false redirect
  if (enabledModules === null && role !== "superadmin") {
    return <div className="p-4">{t("guards.loadingModules")}</div>;
  }

  if (!hasModule(name)) {
    return (
      <Navigate to={homePathForRole(role ?? null)} replace />
    );
  }

  return <Outlet />;
}
