// frontend/src/pages/AdminSentMessages.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSentMessages } from '../api/messages';
import type { Message } from '../types/message';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const AdminSentMessages = () => {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
  const fetchMessages = async () => {
    if (!token) return;
    try {
      const sentMessages = await getSentMessages(token); // ✅ solo globales ya filtrados en backend
      setMessages(sentMessages);
    } catch (error) {
      console.error('Error al cargar mensajes enviados:', error);
    }
  };

  fetchMessages();
}, [token]);


  const toggleMessage = (id: string) => {
    setExpandedMessageId(prev => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📨 Mensajes enviados a todos</h1>
        <button
          onClick={() => navigate(-1)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          ← Volver
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="text-gray-600">No se han enviado mensajes generales aún.</p>
      ) : (
        <ul className="space-y-4">
          {messages.map((msg) => (
            <li
              key={msg._id}
              className="bg-white p-4 rounded shadow hover:shadow-md transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-semibold">{msg.subject}</h2>
                  <p className="text-sm text-gray-500">
                    Enviado el {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <button
                  onClick={() => toggleMessage(msg._id)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  {expandedMessageId === msg._id ? 'Ocultar' : 'Ver'}
                </button>
              </div>

              {expandedMessageId === msg._id && (
                <p className="mt-3 text-gray-700 whitespace-pre-line">{msg.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminSentMessages;
