import { useCallback, useEffect, useRef, useState } from "react";
import { getVacationPendingCount } from "../domain/api";
import { useAuth } from "../../../hooks/useAuth"; // named export
import { useVacationRequestsUpdated } from "./useVacationRequestsUpdated";

type Options = {
  /** Intervalo de refresco en ms. 0 = sin polling (por defecto). */
  pollMs?: number;
  /**
   * Cuando skip=true el hook no realiza ninguna petición y mantiene count=0.
   * Usar cuando el módulo vacation está deshabilitado para esta empresa.
   */
  skip?: boolean;
};

type State = {
  count: number;
  isLoading: boolean;
  isError: boolean;
  error?: string;
};

export default function useAdminVacationsPendingCount(options: Options = {}) {
  const { pollMs = 0, skip = false } = options;

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
    if (!token || skip) return;

    // Loading discreto: solo spinner si aún no tenemos dato (count===0)
    setState((s) => ({ ...s, isLoading: s.count === 0 }));
    try {
      const count = await getVacationPendingCount("pending");
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
          "Error al obtener el contador de vacaciones pendientes",
      }));
      // No intrusivo: dejamos el último valor en pantalla
      // eslint-disable-next-line no-console
      console.warn("[useAdminVacationsPendingCount]", err);
    }
  }, [token, skip]);

  const refresh = useCallback(() => {
    void fetchCount();
  }, [fetchCount]);

  // Primer fetch
  useEffect(() => {
    mountedRef.current = true;
    if (token && !skip) {
      void fetchCount();
    } else {
      setState({
        count: 0,
        isLoading: false,
        isError: false,
        error: undefined,
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCount, token, skip]);

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
  useVacationRequestsUpdated(() => refresh());

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


