// frontend/src/modules/workday/hooks/useAdminSummariesPendingCount.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getSummariesPendingCount } from "../../../modules/workday";
import { useAuth } from "../../../hooks/useAuth"; // named export

type Options = {
  /** Intervalo de refresco en ms. 0 = sin polling (por defecto). */
  pollMs?: number;
};

type State = {
  count: number;
  isLoading: boolean;
  isError: boolean;
  error?: string;
};

// 🔔 Exporta el nombre del evento para poder reutilizarlo donde quieras
export const ADMIN_SUMMARIES_CHANGED_EVENT = "admin-summaries-changed";

export default function useAdminSummariesPendingCount(options: Options = {}) {
  const { pollMs = 0 } = options;

  // Según tu Profile.tsx, useAuth devuelve token directamente
  const { token } = useAuth();

  const [state, setState] = useState<State>({
    count: 0,
    isLoading: false,
    isError: false,
    error: undefined,
  });

  const mountedRef = useRef(true);
  const intervalRef = useRef<number | null>(null);

  const fetchCount = useCallback(async () => {
    if (!token) {
      setState((s) => ({
        ...s,
        isLoading: false,
        isError: false,
        error: undefined,
      }));
      return;
    }
    // Loading discreto: sólo mostramos loading si aún no tenemos dato
    setState((s) => ({ ...s, isLoading: s.count === 0 }));
    try {
      const count = await getSummariesPendingCount(token, "pending");
      if (!mountedRef.current) return;
      setState({ count, isLoading: false, isError: false, error: undefined });
    } catch (err: any) {
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        isLoading: false,
        isError: true,
        error:
          err?.message ??
          "Error al obtener el contador de resúmenes pendientes",
      }));
      // eslint-disable-next-line no-console
      console.warn("[useAdminSummariesPendingCount]", err);
    }
  }, [token]);

  const refresh = useCallback(() => {
    void fetchCount();
  }, [fetchCount]);

  // Primer fetch
  useEffect(() => {
    mountedRef.current = true;
    void fetchCount();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCount]);

  // Refresco al volver a foco
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Refresco al recuperar visibilidad
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  // Refresco por evento global: window.dispatchEvent(new Event('admin-summaries-changed'))
  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener(
      ADMIN_SUMMARIES_CHANGED_EVENT as any,
      onChanged as EventListener,
    );
    return () =>
      window.removeEventListener(
        ADMIN_SUMMARIES_CHANGED_EVENT as any,
        onChanged as EventListener,
      );
  }, [refresh]);

  // Polling opcional
  useEffect(() => {
    if (!pollMs || pollMs <= 0) return;
    intervalRef.current = window.setInterval(() => {
      refresh();
    }, pollMs) as unknown as number;

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollMs, refresh]);

  return {
    ...state, // count, isLoading, isError, error
    refresh,
  };
}

/** Helper para emitir el evento global desde cualquier sitio (páginas, modales, etc.) */
export function notifyAdminSummariesChanged() {
  window.dispatchEvent(new Event(ADMIN_SUMMARIES_CHANGED_EVENT));
}
