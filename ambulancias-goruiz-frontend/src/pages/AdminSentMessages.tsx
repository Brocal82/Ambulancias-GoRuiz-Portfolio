// frontend/src/pages/AdminSentMessages.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSentMessages } from '../api/messages';
import type { Message } from '../types/message';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-800">{msg.subject}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {t('pages.messages.sentPage.sentOn')}{' '}
                      {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleMessage(msg._id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition"
                  >
                    {expandedMessageId === msg._id
                      ? t('pages.messages.sentPage.actions.hide')
                      : t('pages.messages.sentPage.actions.view')}
                  </button>
                </div>

                {expandedMessageId === msg._id && (
                  <p className="mt-3 text-slate-700 text-sm whitespace-pre-line">
                    {msg.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminSentMessages;
