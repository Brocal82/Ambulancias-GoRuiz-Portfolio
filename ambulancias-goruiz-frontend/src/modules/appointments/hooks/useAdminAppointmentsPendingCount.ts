import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getAppointmentsPendingCount } from "../domain/api";
import { useAppointmentsChanged } from "./useAppointmentsChanged";

type Options = {
  /** Intervalo de refresco en ms. 0 = sin polling (default). */
  pollMs?: number;
};

/**
 * Hook para contar citas pendientes (admin).
 * - Llama a GET /appointments/count?status=pending
 * - Refresca en focus/visibilitychange y por sincronización cross-tab (appointments-changed)
 * - Opcionalmente hace polling con pollMs
 */
export function useAdminAppointmentsPendingCount({ pollMs = 0 }: Options = {}) {
  const { token } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const c = await getAppointmentsPendingCount(token);
      if (mountedRef.current) setCount(c);
    } catch (e) {
      // Log suave + estado de error, sin interrumpir UI
      // eslint-disable-next-line no-console
      console.warn("[useAdminAppointmentsPendingCount] fetch error:", e);
      if (mountedRef.current)
        setError("Error al cargar el contador de citas pendientes");
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
      // si no hay token, muestra 0 sin error
      setCount(0);
      setLoading(false);
      setError(null);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [token, fetchCount]);

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

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useAppointmentsChanged(fetchCount);

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
    isLoading: loading,
    error,
    /** Permite refrescar manualmente desde la UI si lo necesitas */
    refresh: fetchCount,
  };
}
