// src/components/RequireRole.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { homePathForRole } from "../utils/roleHomePath";

type AppRole =
  | "admin"
  | "worker"
  | "mecanico"
  | "jefe_mecanicos"
  | "jefe_logistica"
  | "superadmin";

interface RequireRoleProps {
  role: AppRole | AppRole[];
}

/**
 * Protege rutas por rol. Si el usuario no tiene el rol requerido, redirige
 * a su dashboard correspondiente (superadmin / admin / worker).
 */
export default function RequireRole({ role }: RequireRoleProps) {
  const { role: userRole, isAuthReady } = useAuth();
  const { t } = useTranslation();
  const allowedRoles = Array.isArray(role) ? role : [role];

  if (!isAuthReady) {
    return <div className="p-4">{t("guards.loadingSession")}</div>;
  }

  if (!userRole || !allowedRoles.includes(userRole as AppRole)) {
    return <Navigate to={homePathForRole(userRole ?? null)} replace />;
  }

  return <Outlet />;
}
