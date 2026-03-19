// src/components/RequireRole.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type AppRole = "admin" | "worker";

interface RequireRoleProps {
  role: AppRole;
}

/**
 * Protege rutas por rol. Si el usuario no tiene el rol requerido, redirige
 * a su dashboard correspondiente (worker → /worker, admin → /admin).
 */
export default function RequireRole({ role }: RequireRoleProps) {
  const { role: userRole, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <div className="p-4">Cargando sesión...</div>;
  }

  if (userRole !== role) {
    return <Navigate to={userRole === "admin" ? "/admin" : "/worker"} replace />;
  }

  return <Outlet />;
}
