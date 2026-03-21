import { useCallback, useEffect, useRef, useState } from "react";
import { getSickLeavesPendingCount } from "../domain/api";
import { useAuth } from "../../../hooks/useAuth";
import { useSickLeavesChanged } from "./useSickLeavesChanged";

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

export default function useAdminSickLeavesPendingCount(options: Options = {}) {
  const { pollMs = 0 } = options;

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

    // Loading discreto: solo spinner si aún no tenemos dato (count===0)
    setState((s) => ({ ...s, isLoading: s.count === 0 }));

    try {
      // 👇 Ajusta los parámetros si tu API usa otro filtro distinto a 'pending'
      const count = await getSickLeavesPendingCount("pending");
      if (!mountedRef.current) return;

      setState({ count, isLoading: false, isError: false, error: undefined });
    } catch (err: any) {
      if (!mountedRef.current) return;

      setState((s) => ({
        ...s,
        isLoading: false,
        isError: true,
        error:
          err?.message ?? "Error al obtener el contador de bajas pendientes",
      }));

      // eslint-disable-next-line no-console
      console.warn("[useAdminSickLeavesPendingCount]", err);
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

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useSickLeavesChanged(refresh);

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


