import { useEffect, useRef, useState, useCallback } from "react";
import { getMyMessages } from "../domain/api";
import { useAuth } from "../../../hooks/useAuth";

type Options = {
  pollMs?: number; // intervalo de refresco (0 = sin polling)
};

// Nombre del evento global para actualizar el contador
export const UNREAD_MSGS_EVENT = "unread-messages-changed";

export function useUnreadMessagesCount({ pollMs = 30000 }: Options = {}) {
  const { token } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const hasFetchedSuccessRef = useRef(false);

  const fetchCount = useCallback(async () => {
    try {
      if (!token) {
        setCount(0);
        hasFetchedSuccessRef.current = false;
        return;
      }
      // Solo loading en primera carga; polls/refetches no activan loading si ya hay dato
      setLoading(!hasFetchedSuccessRef.current);
      setError(null);
      const msgs = await getMyMessages(); // tu API ya retorna solo no leídos
      const newCount = Array.isArray(msgs) ? msgs.length : 0;
      hasFetchedSuccessRef.current = true;
      setCount(newCount);
    } catch (e: any) {
      setError(e?.message ?? "Error obteniendo mensajes no leídos");
    } finally {
      setLoading(false);
    }
  }, [token]);

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

    // refrescar al emitir evento global desde cualquier parte de la app
    const onExternalChange = () => void fetchCount();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(
      UNREAD_MSGS_EVENT,
      onExternalChange as EventListener,
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        UNREAD_MSGS_EVENT,
        onExternalChange as EventListener,
      );
    };
  }, [fetchCount, pollMs]);

  return { count, loading, error, refresh: fetchCount };
}

// Helper opcional para emitir el evento desde otras pantallas
export function notifyUnreadMessagesChanged() {
  window.dispatchEvent(new Event(UNREAD_MSGS_EVENT));
}
