import { useEffect, useRef, useState, useCallback } from "react";
import { getMyMessages } from "../domain/api";
import { useAuth } from "../../../hooks/useAuth";
import { useMessagesChanged } from "./useMessagesChanged";

type Options = {
  pollMs?: number; // intervalo de refresco (0 = sin polling)
  /**
   * Cuando skip=true el hook no realiza ninguna petición y devuelve count=0.
   * Usar cuando el módulo messages está deshabilitado para esta empresa,
   * evitando 403 repetidos en los listeners de foco/visibilidad/polling.
   */
  skip?: boolean;
};

export function useUnreadMessagesCount({ pollMs = 30000, skip = false }: Options = {}) {
  const { token } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const hasFetchedSuccessRef = useRef(false);
  const forbiddenRef = useRef(false);

  const fetchCount = useCallback(async () => {
    if (!token || skip) {
      forbiddenRef.current = false;
      setCount(0);
      setLoading(false);
      hasFetchedSuccessRef.current = false;
      return;
    }
    if (forbiddenRef.current) return;

    try {
      // Solo loading en primera carga; polls/refetches no activan loading si ya hay dato
      setLoading(!hasFetchedSuccessRef.current);
      setError(null);
      const msgs = await getMyMessages(); // tu API ya retorna solo no leídos
      const newCount = Array.isArray(msgs) ? msgs.length : 0;
      hasFetchedSuccessRef.current = true;
      setCount(newCount);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        forbiddenRef.current = true;
        setCount(0);
      }
      setError(e?.message ?? "Error obteniendo mensajes no leídos");
    } finally {
      setLoading(false);
    }
  }, [token, skip]);

  useEffect(() => {
    // primera carga
    void fetchCount();

    // polling opcional
    if (pollMs > 0) {
      intervalRef.current = window.setInterval(fetchCount, pollMs);
    }

    // refrescar al volver el foco/visibilidad
    const onFocus = () => void fetchCount();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchCount();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchCount, pollMs]);

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useMessagesChanged(fetchCount);

  return { count, loading, error, refresh: fetchCount };
}
