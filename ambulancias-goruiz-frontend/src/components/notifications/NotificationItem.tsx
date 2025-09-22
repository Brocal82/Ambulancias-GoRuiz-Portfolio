
import type { NotificationItem as Item } from '../../types/notification';

type Props = {
  item: Item;
  onMarkRead: (id: string) => void;
};

function formatLocal(iso: string) {
  // Simple y sin dependencias; si prefieres, cámbialo a tu util de tiempo existente
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function NotificationItem({ item, onMarkRead }: Props) {
  const chip = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
    message: 'bg-sky-100 text-sky-700',
    report: 'bg-amber-100 text-amber-700',
    summary: 'bg-indigo-100 text-indigo-700',
  }[item.type];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50">
      {/* Indicador leído/no leído */}
      <div
        className={`mt-1 h-2 w-2 rounded-full ${item.isRead ? 'bg-gray-300' : 'bg-blue-500'}`}
        aria-label={item.isRead ? 'Leído' : 'Nuevo'}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">{item.title}</h4>
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${chip}`}>
            {item.type}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-700">{item.message}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span>{formatLocal(item.createdAt)}</span>
          {!item.isRead && (
            <button
              onClick={() => onMarkRead(item._id)}
              className="rounded-md border border-blue-200 px-2 py-1 text-blue-700 hover:bg-blue-50"
            >
              Marcar como leída
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
