// frontend/src/pages/AdminUserMessageTab.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendMessage } from '../api/messages';
import { toast } from 'react-toastify';

interface Props {
  userId: string;
}

const AdminUserMessageTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

const handleSend = async () => {
  if (!subject || !body) {
    toast.warn('Por favor, completa el asunto y el cuerpo del mensaje');
    return;
  }

  if (!token) return;

  setLoading(true);
  try {
    await sendMessage(token, {
      subject,
      body,
      recipients: [userId],
    });

    toast.success('Mensaje enviado correctamente');
    setSubject('');
    setBody('');
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error);
    toast.error('Hubo un error al enviar el mensaje');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">📩 Enviar mensaje al trabajador</h2>

      <div className="flex flex-col">
        <label htmlFor="subject" className="font-medium mb-1">Asunto</label>
        <input
          id="subject"
          type="text"
          placeholder="Escribe el asunto del mensaje"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor="body" className="font-medium mb-1">Mensaje</label>
        <textarea
          id="body"
          placeholder="Escribe tu mensaje aquí..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="border p-2 rounded resize-y"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </div>
  );
};

export default AdminUserMessageTab;
