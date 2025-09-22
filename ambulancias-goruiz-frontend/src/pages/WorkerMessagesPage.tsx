// frontend/src/pages/WorkerMessagesPage.tsx
import { useEffect, useState } from 'react';
import { getMyMessages, deleteMessageForUser } from '../api/messages';
import type { Message } from '../types/message';
import { useAuth } from '../hooks/useAuth';
import { toastT } from "../utils/toast";
import { useTranslation } from 'react-i18next';
import { getPublicUrl } from '../utils/url'; // 👈 NUEVO

const WorkerMessagesPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await getMyMessages(token!);
        setMessages(data);
      } catch (error) {
        console.error('❌ Error al cargar mensajes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [token]);

  const handleDelete = async (messageId: string) => {
    if (!token) return;

    try {
      await deleteMessageForUser(token, messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (error) {
      console.error('❌ Error al borrar mensaje:', error);
      toastT.error(["toasts.messages.deleteError"]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
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
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className="relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition"
              >
                {/* Botón eliminar */}
                <button
                  onClick={() => handleDelete(msg._id)}
                  className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full
                    bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400
                    focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  title={t('pages.messages.workerPage.actions.deleteTitle')}
                >
                  <span className="sr-only">
                    {t('pages.messages.workerPage.actions.deleteTitle')}
                  </span>
                  ×
                </button>

                {/* Asunto */}
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  {msg.subject}
                </h2>

                {/* Info remitente */}
                <p className="text-sm text-slate-500 mb-3">
                  {t('pages.messages.workerPage.from')}{' '}
                  <span className="font-medium">
                    {msg.sender.lastName}, {msg.sender.name}
                  </span>{' '}
                  · {new Date(msg.sentAt).toLocaleString()}
                </p>

                {/* Cuerpo */}
                <p className="text-slate-700 whitespace-pre-line">{msg.body}</p>

                {/* Adjuntos */}
                {msg.attachments?.length ? (
                  <div className="mt-3">
                    <h3 className="text-sm font-medium text-slate-700">
                      {t('pages.messages.workerPage.attachments') || 'Attachments'}
                    </h3>
                    <ul className="mt-1 space-y-1">
                      {msg.attachments.map((att) => (
                        <li key={att.filename} className="flex items-center gap-2">
                          <a
                            href={getPublicUrl(att.url)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerMessagesPage;
