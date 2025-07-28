// frontend/src/pages/WorkerMessagesPage.tsx
import { useEffect, useState } from 'react';
import { getMyMessages, deleteMessageForUser } from '../api/messages';
import type { Message } from '../types/message';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

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

  const handleDelete = async (messageId: string) => {
    if (!token) return;

    try {
      await deleteMessageForUser(token, messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (error) {
      console.error('❌ Error al borrar mensaje:', error);
      toast.error('Error al borrar el mensaje');
    }
  };

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
            <div
              key={msg._id}
              className="relative bg-white p-4 rounded shadow hover:shadow-md transition"
            >
              <button
                onClick={() => handleDelete(msg._id)}
                className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-xl font-bold"
                title="Borrar mensaje"
              >
                ×
              </button>
              <h2 className="text-lg font-semibold">{msg.subject}</h2>
              <p className="text-sm text-gray-500 mb-2">
                De: {msg.sender.name} {msg.sender.lastName} ·{' '}
                {new Date(msg.sentAt).toLocaleString()}
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
