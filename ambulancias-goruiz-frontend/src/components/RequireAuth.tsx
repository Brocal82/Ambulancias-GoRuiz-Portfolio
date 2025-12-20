// src/components/RequireAuth.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RequireAuth() {
  const { token, isAuthReady } = useAuth();

  // ⛔ Evita el parpadeo: no redirigir antes de tiempo
  if (!isAuthReady) {
    return <div className="p-4">Cargando sesión...</div>;
    // o: return null;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
