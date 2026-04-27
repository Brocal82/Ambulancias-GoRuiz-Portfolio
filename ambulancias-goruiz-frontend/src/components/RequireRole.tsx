// src/components/RequireRole.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type AppRole =
  | "admin"
  | "worker"
  | "mecanico"
  | "jefe_mecanicos"
  | "jefe_logistica"
  | "superadmin";

interface RequireRoleProps {
  role: AppRole;
}

function homePathForRole(userRole: string | null): string {
  if (userRole === "superadmin") return "/superadmin";
  if (userRole === "admin") return "/admin";
  return "/worker";
}

/**
 * Protege rutas por rol. Si el usuario no tiene el rol requerido, redirige
 * a su dashboard correspondiente (superadmin / admin / worker).
 */
export default function RequireRole({ role }: RequireRoleProps) {
  const { role: userRole, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <div className="p-4">Cargando sesión...</div>;
  }

  if (userRole !== role) {
    return <Navigate to={homePathForRole(userRole)} replace />;
  }

  return <Outlet />;
}
