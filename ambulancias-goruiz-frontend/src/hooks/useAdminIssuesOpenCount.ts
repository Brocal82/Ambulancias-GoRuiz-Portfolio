import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { getIssuesOpenCount } from "../api/workdaySummary";

/** Evento global para forzar refresco tras cambios en averías (crear, cerrar, borrar, marcar vistas, etc.) */
export const ADMIN_ISSUES_CHANGED_EVENT = "admin-issues-changed";

type Options = {
  /** Intervalo de refresco en ms. 0 = sin polling (default). */
  pollMs?: number;
};

/**
 * Hook para contar averías "abiertas" (admin).
 * - Llama a GET /workday-summary/issues/count?status=open
 * - Refresca en focus/visibilitychange y al emitir el evento global 'admin-issues-changed'
 * - Polling opcional con pollMs
 */
export function useAdminIssuesOpenCount({ pollMs = 0 }: Options = {}) {
  const { token } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const c = await getIssuesOpenCount(token);
      if (mountedRef.current) setCount(c);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[useAdminIssuesOpenCount] fetch error:", e);
      if (mountedRef.current)
        setError("Error al cargar el contador de averías");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token]);

  // Carga inicial y cuando cambie el token
  useEffect(() => {
    mountedRef.current = true;
    if (token) {
      setLoading(true);
      void fetchCount();
    } else {
      setCount(0);
      setLoading(false);
      setError(null);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [token, fetchCount]);

  // Refrescar al volver el foco / visibilidad y por evento global
  useEffect(() => {
    const onFocus = () => fetchCount();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    const onChanged = () => fetchCount();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(
      ADMIN_ISSUES_CHANGED_EVENT as any,
      onChanged as EventListener,
    );

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        ADMIN_ISSUES_CHANGED_EVENT as any,
        onChanged as EventListener,
      );
    };
  }, [fetchCount]);

  // Polling opcional
  useEffect(() => {
    if (!pollMs || pollMs <= 0) return;
    const id = window.setInterval(() => {
      void fetchCount();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, fetchCount]);

  return {
    count,
    loading,
    isLoading: loading, // alias
    error,
    refresh: fetchCount,
  };
}

/** Helper para emitir el evento global tras acciones que cambien el conteo (crear/cerrar/borrar/marcar visto) */
export function notifyAdminIssuesChanged() {
  window.dispatchEvent(new Event(ADMIN_ISSUES_CHANGED_EVENT));
}
