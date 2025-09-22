// frontend/src/pages/AdminSentMessages.tsx
import { useEffect, useState } from 'react';
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
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
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

  const toggleMessage = (id: string) => {
    setExpandedMessageId(prev => (prev === id ? null : id));
  };

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

      // ✅ Toast de éxito
      toastT.success(
        t('pages.messages.sentPage.deleted') || 'Message deleted'
      );
    } catch (error) {
      console.error('❌ Error deleting message:', error);

      // ❌ Toast de error
      toastT.error(
        t('pages.messages.sentPage.deleteError') ||
          'Error deleting the message'
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
        >
          {t('pages.messages.sentPage.actions.back')}
        </button>
      </div>

      {/* Lista de mensajes */}
      <div className="max-w-4xl mx-auto">
        {messages.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">
            {t('pages.messages.sentPage.empty')}
          </p>
        ) : (
          <ul className="space-y-4">
            {messages.map((msg) => (
              <li
                key={msg._id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition relative"
              >
                {/* Botón de borrar en la esquina superior derecha */}
                <button
                  onClick={() => handleDelete(msg._id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                  title={t('pages.messages.sentPage.actions.delete') || 'Borrar mensaje'}
                  aria-label={t('pages.messages.sentPage.actions.delete') || 'Borrar mensaje'}
                >
                  ×
                </button>

                {/* Contenido del mensaje */}
                <div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t('pages.messages.sentPage.sentOn')}{' '}
                    {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                  <h2 className="font-semibold text-slate-800 pr-6">{msg.subject}</h2>

                  {expandedMessageId === msg._id && (
                    <>
                      <p className="mt-3 text-slate-700 text-sm whitespace-pre-line">
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
                    </>
                  )}
                </div>

                {/* Botón Ver/Ocultar abajo a la izquierda */}
                <div className="mt-4">
                  <button
                    onClick={() => toggleMessage(msg._id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition"
                  >
                    {expandedMessageId === msg._id
                      ? t('pages.messages.sentPage.actions.hide')
                      : t('pages.messages.sentPage.actions.view')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminSentMessages;
