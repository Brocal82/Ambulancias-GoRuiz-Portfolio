// frontend/src/pages/WorkerMessagesPage.tsx
import { useEffect, useRef, useState } from 'react';
import { getMyMessages, deleteMessageForUser, markMessageAsRead } from '../api/messages';
import type { Message } from '../types/message';
import { useAuth } from '../hooks/useAuth';
import { toastT } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { getPublicUrl } from '../utils/url';
import { format } from 'date-fns';
import { notifyUnreadMessagesChanged } from '../hooks/useUnreadMessagesCount';

const WorkerMessagesPage = () => {
  const { token, user } = useAuth(); // ⬅️ añadimos user para saber si está leído por mí
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const markedAnyAsReadRef = useRef(false);

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
    fetchMessages();
  }, [token]);

  // Helper: ¿este mensaje está sin leer por mí?
  const isUnread = (msg: Message) => {
    const me = user?._id;
    if (!me) return false;
    const readBy = (msg.readBy as unknown as string[]) || [];
    return !readBy.some(u => String(u) === String(me));
  };

  const toggleMessage = async (id: string) => {
    if (expandedMessageId === id) {
      setExpandedMessageId(null);
      return;
    }
    setExpandedMessageId(id);

    // Marcar como leído al ver (pero mantener en la lista)
    if (token && user?._id) {
      try {
        await markMessageAsRead(token, id);
        // Refresca badge del dashboard
        notifyUnreadMessagesChanged();
        markedAnyAsReadRef.current = true;

        // Actualiza estado local para que el estilo cambie inmediatamente
        setMessages(prev =>
          prev.map(m =>
            m._id === id
              ? {
                ...m,
                readBy: Array.from(
                  new Set([...(m.readBy as unknown as string[] | undefined || []), String(user._id)])
                ) as unknown as Message['readBy'],
              }
              : m
          )
        );
      } catch (error) {
        console.error('❌ Error al marcar como leído:', error);
      }
    }
  };

  // Al salir de la página, emite el evento por si la navegación fue muy rápida
  useEffect(() => {
    return () => {
      if (markedAnyAsReadRef.current) {
        notifyUnreadMessagesChanged();
      }
    };
  }, []);

  const handleDelete = async (messageId: string) => {
    if (!token) return;
    try {
      await deleteMessageForUser(token, messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
      if (expandedMessageId === messageId) setExpandedMessageId(null);

      // Refresca contador del dashboard
      notifyUnreadMessagesChanged();
      // toastT.success(['toasts.messages.deleteSuccess']); // opcional
    } catch (error) {
      console.error('❌ Error al borrar mensaje:', error);
      toastT.error(['toasts.messages.deleteError']);
    }
  };

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
        ) : messages.length === 0 ? (
          <p className="text-center text-slate-400">
            {t('pages.messages.workerPage.empty')}
          </p>
        ) : (
          <ul className="space-y-4">
            {messages.map(msg => {
              const unread = isUnread(msg);
              return (
                <li
                  key={msg._id}
                  className={[
                    'relative rounded-xl border p-4 shadow-sm transition bg-white',
                    unread
                      ? 'border-slate-200 ring-1 ring-blue-300/60 bg-blue-50 pl-4 border-l-4 border-l-blue-500'
                      : 'border-slate-200 hover:shadow-md'
                    ,
                  ].join(' ')}
                >

                  {/* Botón de borrar arriba derecha */}
                  <button
                    onClick={() => void handleDelete(msg._id)}
                    className="absolute top-2 right-2 text-rose-600 hover:text-rose-700 font-bold text-lg leading-none"
                    title={t('pages.messages.workerPage.actions.deleteTitle') || 'Delete message'}
                    aria-label={t('pages.messages.workerPage.actions.deleteTitle') || 'Delete message'}
                  >
                    ×
                  </button>

                  {/* Encabezado: fecha y asunto */}
                  <div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {t('pages.messages.workerPage.from') || 'From'}{' '}
                      <span className="font-medium">
                        {msg.sender?.lastName}, {msg.sender?.name}
                      </span>{' '}
                      · {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
                    </p>

                    <h2
                      className={[
                        'pr-6',
                        unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800',
                      ].join(' ')}
                    >
                      {msg.subject}
                    </h2>

                    {expandedMessageId === msg._id && (
                      <>
                        <p className="mt-3 text-slate-700 text-sm whitespace-pre-line">
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
                      </>
                    )}
                  </div>

                  {/* Botón Ver/Ocultar */}
                  <div className="mt-4">
                    <button
                      onClick={() => void toggleMessage(msg._id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition"
                    >
                      {expandedMessageId === msg._id
                        ? (t('pages.messages.sentPage.actions.hide') || 'Hide')
                        : (t('pages.messages.sentPage.actions.view') || 'View')}
                    </button>
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
