// src/components/RequireModule.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModules } from "../hooks/useModules";

interface RequireModuleProps {
  /** Canonical module key, e.g. "hospitals", "vacation", "scheduling". */
  name: string;
}

function homePathForRole(role: string | null): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  return "/worker";
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
 *
 * NOT USED ON ANY ROUTE in Phase 0. Add to routes in Phase 1+.
 */
export default function RequireModule({ name }: RequireModuleProps) {
  const { isAuthReady, role } = useAuth();
  const { hasModule, enabledModules } = useModules();

  if (!isAuthReady) {
    return <div className="p-4">Cargando sesión...</div>;
  }

  // While modules are still loading, show spinner to prevent a false redirect
  if (enabledModules === null && role !== "superadmin") {
    return <div className="p-4">Cargando...</div>;
  }

  if (!hasModule(name)) {
    return (
      <Navigate to={homePathForRole(role)} replace />
    );
  }

  return <Outlet />;
}
