import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getIssuesOpenCount } from "../domain/api";
import { emitMechanicsIssuesChanged } from "../utils/mechanicsEvents";
import { useMechanicsIssuesChanged } from "./useMechanicsIssuesChanged";

type Options = {
  /** Intervalo de refresco en ms. 0 = sin polling (default). */
  pollMs?: number;
  /** Sin peticiones si el módulo mechanics está desactivado. */
  skip?: boolean;
};

/**
 * Hook para contar aver­as "abiertas" (admin).
 * - Llama a GET /mechanics/issues/count?status=open
 * - Refresca en focus/visibilitychange y al emitir el evento global 'admin-issues-changed'
 * - Polling opcional con pollMs
 */
export function useAdminIssuesOpenCount({
  pollMs = 0,
  skip = false,
}: Options = {}) {
  const { token } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    if (!token || skip) return;
    try {
      setError(null);
      const c = await getIssuesOpenCount();
      if (mountedRef.current) setCount(c);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[useAdminIssuesOpenCount] fetch error:", e);
      if (mountedRef.current)
        setError("Error al cargar el contador de aver­as");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, skip]);

  // Carga inicial y cuando cambie el token
  useEffect(() => {
    mountedRef.current = true;
    if (skip) {
      setCount(0);
      setLoading(false);
      setError(null);
    } else if (token) {
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
  }, [token, fetchCount, skip]);

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useMechanicsIssuesChanged(fetchCount);

  // Refrescar al volver el foco / visibilidad
  useEffect(() => {
    const onFocus = () => fetchCount();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
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

/** Helper para emitir tras cambios en averías (crear/cerrar/borrar/marcar visto). Cross-tab via CustomEvent + BroadcastChannel + storage. */
export function notifyAdminIssuesChanged() {
  emitMechanicsIssuesChanged();
}
