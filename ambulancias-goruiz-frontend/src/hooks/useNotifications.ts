import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getNotifications, markNotificationAsRead } from "../api/notifications";
import type {
  NotificationListResponse,
  NotificationRole,
} from "../types/notification";

type UseNotificationsOptions = {
  role?: NotificationRole; // 'admin' | 'worker'
  userId?: string; // cuando quieras filtrar por usuario
  unreadOnly?: boolean; // p.ej. true para solo no leídos
  type?: string; // 'message' | 'report' | 'summary' | ...
  page?: number; // estado externo si lo prefieres controlar fuera
  limit?: number; // size por página
  pollMs?: number; // intervalo de refresco; 0 para desactivar (default: 30000)
};

export function useNotifications(opts: UseNotificationsOptions) {
  const {
    role,
    userId,
    unreadOnly = false,
    type,
    page = 1,
    limit = 10,
    pollMs = 30000,
  } = opts;

  const [data, setData] = useState<NotificationListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNotifications({
        ...(role ? { role } : {}),
        userId,
        unreadOnly,
        type,
        page,
        limit,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando notificaciones");
    } finally {
      setLoading(false);
    }
  }, [role, userId, unreadOnly, type, page, limit]);

  useEffect(() => {
    // primera carga
    fetchData();

    // polling opcional
    if (pollMs > 0) {
      intervalRef.current = window.setInterval(fetchData, pollMs);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
    // si pollMs === 0, no montamos intervalo
    return;
  }, [fetchData, pollMs]);

  const unreadCount = useMemo(
    () => (data?.items ?? []).filter((n) => !n.isRead).length,
    [data],
  );

  const refresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const markAsRead = useCallback(async (id: string) => {
    await markNotificationAsRead(id);
    // Actualizamos estado local sin volver a pegar al servidor
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) =>
          it._id === id ? { ...it, isRead: true } : it,
        ),
      };
    });
  }, []);

  return {
    data, // { items, page, limit, total, totalPages }
    loading,
    error,
    unreadCount, // contador de no leídos
    refresh, // refresco manual
    markAsRead, // acción
  };
}
