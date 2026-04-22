import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getAdminManualPraemiePendingCount } from "../domain/manualDailyApi";
import { PRAEMIEN_MANUAL_PENDING_CHANGED } from "../utils/praemienManualPendingEvents";

type Options = {
  /** No llama a la API (p. ej. módulo desactivado). */
  skip?: boolean;
  pollMs?: number;
};

type State = {
  count: number;
  isLoading: boolean;
  isError: boolean;
};

/**
 * Número de días/entradas manuales de Prämien con estado
 * `submitted` o `reopened` pendientes de acción del admin.
 */
export default function useAdminManualPraemiePendingCount(options: Options = {}) {
  const { skip = false, pollMs = 0 } = options;
  const { token } = useAuth();

  const [state, setState] = useState<State>({
    count: 0,
    isLoading: false,
    isError: false,
  });

  const mountedRef = useRef(true);
  const intervalRef = useRef<number | null>(null);

  const fetchCount = useCallback(async () => {
    if (skip || !token) {
      setState((s) => ({ ...s, isLoading: false, isError: false, count: 0 }));
      return;
    }
    setState((s) => ({ ...s, isLoading: s.count === 0 }));
    try {
      const count = await getAdminManualPraemiePendingCount();
      if (!mountedRef.current) return;
      setState({ count, isLoading: false, isError: false });
    } catch {
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        isLoading: false,
        isError: true,
      }));
    }
  }, [token, skip]);

  const refresh = useCallback(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchCount();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCount]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  useEffect(() => {
    const onPendingChanged = () => refresh();
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onPendingChanged);
    return () =>
      window.removeEventListener(
        PRAEMIEN_MANUAL_PENDING_CHANGED,
        onPendingChanged,
      );
  }, [refresh]);

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
    count: state.count,
    isLoading: state.isLoading,
    isError: state.isError,
    refresh,
  };
}
