// frontend/src/pages/WorkerMessagesPage.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getMyMessages, deleteMessageForUser, markMessageAsRead } from '../api/messages';
import type { Message } from '../types/message';
import { useAuth } from '../hooks/useAuth';
import { toastT } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { getPublicUrl } from '../utils/url';
import { format } from 'date-fns';
import { notifyUnreadMessagesChanged } from '../hooks/useUnreadMessagesCount';

const WorkerMessagesPage = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const markedAnyAsReadRef = useRef(false);

  const meId = user?._id ? String(user._id) : null;

  // helper: ¿no leído por mí?
  const isUnread = useCallback(
    (msg: Message) => {
      if (!meId) return false;
      const readBy = (msg.readBy as unknown as string[]) || [];
      return !readBy.some(u => String(u) === meId);
    },
    [meId]
  );

  // ordenamos por fecha desc
  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      ),
    [messages]
  );

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await getMyMessages(token!, { unreadOnly: false });
        setMessages(data);
      } catch (error) {
        console.error('❌ Error al cargar mensajes:', error);
      } finally {
        setLoading(false);
      }
    };
    if (token) void fetchMessages();
  }, [token]);

  const handleDelete = async (messageId: string) => {
    if (!token) return;
    try {
      await deleteMessageForUser(token, messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      notifyUnreadMessagesChanged();
      // toastT.success(['toasts.messages.deleteSuccess']); // si tienes i18n
    } catch (error) {
      console.error('❌ Error al borrar mensaje:', error);
      toastT.error(['toasts.messages.deleteError']);
    }
  };

  const toggleMessage = useCallback(
    async (msg: Message) => {
      const id = msg._id;

      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

      // si se abre por primera vez y estaba no leído → marcar como leído
      const wasExpanded = expanded.has(id);
      if (!wasExpanded && token && meId && isUnread(msg)) {
        try {
          await markMessageAsRead(token, id);
          markedAnyAsReadRef.current = true;
          notifyUnreadMessagesChanged();
          // actualizar estado local: añadir mi id a readBy
          setMessages(prev =>
            prev.map(m =>
              m._id === id
                ? {
                    ...m,
                    readBy: Array.from(
                      new Set([...(m.readBy as unknown as string[] | undefined || []), meId])
                    ) as unknown as Message['readBy'],
                  }
                : m
            )
          );
        } catch (error) {
          console.error('❌ Error al marcar como leído:', error);
        }
      }
    },
    [expanded, token, meId, isUnread]
  );

  // al salir de la página, por si hubo varias lecturas rápidas
  useEffect(() => {
    return () => {
      if (markedAnyAsReadRef.current) notifyUnreadMessagesChanged();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6 text-center">
          {t('pages.messages.workerPage.title')}
        </h1>

        {loading ? (
          <p className="text-center text-slate-500">
            {t('pages.messages.workerPage.loading')}
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">
            {t('pages.messages.workerPage.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map(msg => {
              const unread = isUnread(msg);
              const isOpen = expanded.has(msg._id);

              const btnId = `msg-toggle-${msg._id}`;
              const panelId = `msg-panel-${msg._id}`;

              return (
                <li
                  key={msg._id}
                  className={[
                    'relative rounded-xl ring-1 transition overflow-hidden bg-white',
                    isOpen ? 'ring-slate-300 shadow-sm' : 'ring-slate-200 hover:ring-slate-300',
                  ].join(' ')}
                >
                  {/* Header / botón accesible */}
                  <button
                    id={btnId}
                    type="button"
                    onClick={() => void toggleMessage(msg)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    {/* dot rojo si no leído */}
                    <span
                      className={[
                        'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0',
                        unread ? 'bg-red-500' : 'bg-slate-300',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                    {/* fecha + remitente */}
                    <span className="text-sm text-slate-600">
                      {t('pages.messages.workerPage.from') || 'From'}{' '}
                      <span className="font-medium">
                        {msg.sender?.lastName}, {msg.sender?.name}
                      </span>{' '}
                      · {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
                    </span>
                    {/* asunto a la derecha */}
                    <span
                      className={[
                        'ml-auto truncate',
                        unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800',
                      ].join(' ')}
                      title={msg.subject}
                    >
                      {msg.subject}
                    </span>
                    {/* chevron */}
                    <span
                      className={[
                        'ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-base transition-transform',
                        isOpen ? 'rotate-180' : 'rotate-0',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </button>

                  {/* Panel: siempre en el DOM */}
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    hidden={!isOpen}
                    className="px-5 pb-5 pt-1 border-t border-slate-100"
                  >
                    {/* Acciones (borrar) */}
                    <div className="flex items-center justify-end mb-3">
                      <button
                        onClick={() => void handleDelete(msg._id)}
                        className="text-rose-600 hover:text-rose-700 font-bold text-lg leading-none transition"
                        title={t('pages.messages.workerPage.actions.deleteTitle') || 'Delete message'}
                        aria-label={t('pages.messages.workerPage.actions.deleteTitle') || 'Delete message'}
                        type="button"
                      >
                        ×
                      </button>
                    </div>

                    {/* Cuerpo */}
                    <p className="mt-1 text-slate-700 text-sm whitespace-pre-line">
                      {msg.body}
                    </p>

                    {/* Adjuntos */}
                    {msg.attachments?.length ? (
                      <div className="mt-3">
                        <h3 className="text-sm font-medium text-slate-700">
                          {t('pages.messages.workerPage.attachments') || 'Attachments'}
                        </h3>
                        <ul className="mt-1 space-y-1">
                          {msg.attachments.map(att => (
                            <li key={att.filename} className="flex items-center gap-2">
                              <a
                                href={`${getPublicUrl(att.url)}?v=${encodeURIComponent(att.filename)}-${encodeURIComponent(msg.sentAt)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                              >
                                {att.originalName}
                              </a>
                              <span className="text-xs text-slate-500">
                                {att.mimetype} · {(att.size / 1024).toFixed(1)} KB
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WorkerMessagesPage;
