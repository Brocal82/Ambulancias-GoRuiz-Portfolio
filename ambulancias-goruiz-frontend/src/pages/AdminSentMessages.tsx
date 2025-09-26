// frontend/src/pages/AdminSentMessages.tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSentMessages, deleteMessage } from '../api/messages';
import type { Message } from '../types/message';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toastT } from '../utils/toast';
import { useTranslation } from 'react-i18next';
import { getPublicUrl } from '../utils/url';

const AdminSentMessages = () => {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchMessages = async () => {
      if (!token) return;
      try {
        const sentMessages = await getSentMessages(token);
        setMessages(sentMessages);
      } catch (error) {
        console.error('❌ Error al cargar mensajes enviados:', error);
      }
    };
    fetchMessages();
  }, [token]);

  // Orden descendente por fecha
  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      ),
    [messages]
  );

  const toggleMessage = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!token) return;

    if (
      !window.confirm(
        t('pages.messages.sentPage.confirmDelete') ||
          'Are you sure you want to delete this message?'
      )
    ) {
      return;
    }

    try {
      await deleteMessage(id, token);
      setMessages(prev => prev.filter(m => m._id !== id));
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toastT.success(t('pages.messages.sentPage.deleted') || 'Message deleted');
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      toastT.error(
        t('pages.messages.sentPage.deleteError') || 'Error deleting the message'
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {t('pages.messages.sentPage.title')}
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          type="button"
        >
          {t('pages.messages.sentPage.actions.back')}
        </button>
      </div>

      {/* Lista de mensajes */}
      <div className="max-w-4xl mx-auto">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">
            {t('pages.messages.sentPage.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((msg) => {
              const isOpen = expanded.has(msg._id);
              const btnId = `sent-toggle-${msg._id}`;
              const panelId = `sent-panel-${msg._id}`;

              return (
                <li
                  key={msg._id}
                  className={[
                    'relative rounded-xl ring-1 transition overflow-hidden bg-white',
                    isOpen ? 'ring-slate-300 shadow-sm' : 'ring-slate-200 hover:ring-slate-300',
                  ].join(' ')}
                >
                  {/* Cabecera clickable accesible */}
                  <button
                    id={btnId}
                    type="button"
                    onClick={() => toggleMessage(msg._id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    {/* Fecha */}
                    <span className="text-sm text-slate-600">
                      {t('pages.messages.sentPage.sentOn')}{' '}
                      {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
                    </span>
                    {/* Asunto */}
                    <span
                      className="ml-auto truncate font-semibold text-slate-800"
                      title={msg.subject}
                    >
                      {msg.subject}
                    </span>
                    {/* Chevron */}
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

                  {/* Panel */}
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    hidden={!isOpen}
                    className="px-5 pb-5 pt-1 border-t border-slate-100"
                  >
                    {/* Acción borrar */}
                    <div className="flex items-center justify-end mb-3">
                      <button
                        onClick={() => handleDelete(msg._id)}
                        className="text-rose-600 hover:text-rose-700 font-bold text-lg leading-none transition"
                        title={t('pages.messages.sentPage.actions.delete') || 'Delete message'}
                        aria-label={t('pages.messages.sentPage.actions.delete') || 'Delete message'}
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
                          {t('pages.messages.sentPage.attachments') || 'Attachments'}
                        </h3>
                        <ul className="mt-1 space-y-1">
                          {msg.attachments.map((att) => (
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

export default AdminSentMessages;
