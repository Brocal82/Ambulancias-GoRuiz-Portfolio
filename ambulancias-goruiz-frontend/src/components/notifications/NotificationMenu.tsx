import { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import type { NotificationRole } from '../../types/notification';

type Props = {
  role: NotificationRole;   // 'admin' | 'worker'
  userId?: string;          // opcional si filtras por usuario
  type?: string;            // opcional para menú específico por módulo ('message'|'report'|'summary'|...)
  initialPage?: number;
  limit?: number;
  pollMs?: number;          // sobrescribe el intervalo del hook si quieres
};

export default function NotificationMenu({
  role,
  userId,
  type,
  initialPage = 1,
  limit = 10,
  pollMs = 30000,
}: Props) {
  const [page, setPage] = useState(initialPage);

  const { data, loading, error, markAsRead, refresh } = useNotifications({
    role,
    userId,
    type,
    page,
    limit,
    pollMs,
  });

  return (
    <div className="z-50 w-[28rem] max-w-[90vw] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold">Notificaciones</h3>
        <button
          onClick={refresh}
          className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      {loading && <div className="p-6 text-center text-sm text-gray-500">Cargando…</div>}
      {error && <div className="p-6 text-center text-sm text-red-600">{error}</div>}

      {!loading && !error && (data?.items.length ?? 0) === 0 && (
        <div className="p-6 text-center text-sm text-gray-500">No hay notificaciones.</div>
      )}

      <div className="flex flex-col gap-2">
        {data?.items.map((item) => (
          <NotificationItem key={item._id} item={item} onMarkRead={markAsRead} />
        ))}
      </div>

      {/* Paginación simple */}
      {!!data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border px-2 py-1 disabled:opacity-50"
          >
            Anterior
          </button>
          <span>
            Página {data.page} de {data.totalPages}
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            className="rounded-md border px-2 py-1 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
