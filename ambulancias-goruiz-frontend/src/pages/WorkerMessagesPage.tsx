// frontend/src/pages/WorkerMessagesPage.tsx
import { useEffect, useState } from 'react';
import { getMyMessages } from '../api/messages';
import type { Message } from '../types/message';
import { useAuth } from '../hooks/useAuth';

const WorkerMessagesPage = () => {
  const { token } = useAuth();
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

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">📨 Tus Mensajes</h1>

      {loading ? (
        <p className="text-center">Cargando mensajes...</p>
      ) : messages.length === 0 ? (
        <p className="text-center text-gray-500">No tienes mensajes.</p>
      ) : (
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg._id} className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-semibold">{msg.subject}</h2>
              <p className="text-sm text-gray-500 mb-2">
                De: {msg.sender.name} {msg.sender.lastName} · {new Date(msg.sentAt).toLocaleString()}
              </p>
              <p>{msg.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerMessagesPage;
