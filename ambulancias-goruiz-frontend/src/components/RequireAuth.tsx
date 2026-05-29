// src/components/RequireAuth.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import RealtimeSyncMount from "./RealtimeSyncMount";

export default function RequireAuth() {
  const { token, isAuthReady } = useAuth();
  const { t } = useTranslation();

  // ⛔ Evita el parpadeo: no redirigir antes de tiempo
  if (!isAuthReady) {
    return <div className="p-4">{t("guards.loadingSession")}</div>;
    // o: return null;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <RealtimeSyncMount />
      <Outlet />
    </>
  );
}
