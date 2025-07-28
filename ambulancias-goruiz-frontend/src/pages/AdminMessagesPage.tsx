// frontend/src/pages/AdminMessagesPage.tsx
import { useEffect, useState } from 'react';
import { getAllUsers } from '../api/users';
import { sendMessage } from '../api/messages';
import type { User } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const AdminMessagesPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getAllUsers(token!);
        const workersOnly = data.filter((user) => user.role === 'worker');
        setUsers(workersOnly);
      } catch (error) {
        console.error('❌ Error al cargar usuarios:', error);
      }
    };

    fetchUsers();
  }, [token]);

  const handleSend = async () => {
  const recipients = sendToAll ? users.map((u) => u._id) : selectedIds;

  if (!subject || !body || recipients.length === 0) {
    toast.warning('Completa todos los campos y selecciona al menos un receptor');
    return;
  }

  try {
    await sendMessage(token!, {
      subject,
      body,
      recipients,
      toAllWorkers: sendToAll, // ✅ ESTA LÍNEA ES LA CLAVE
    });
    toast.success('Mensaje enviado correctamente');
    setSubject('');
    setBody('');
    setSelectedIds([]);
    setSendToAll(false);
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error);
    toast.error('Error al enviar el mensaje');
  }
};


return (
  <div className="min-h-screen bg-gray-100 p-6">
    <h1 className="text-2xl font-bold mb-6 text-center">📨 Enviar Mensaje</h1>

    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-4">
      <div>
        <label className="block font-semibold mb-1">Asunto</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Asunto del mensaje"
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div>
        <label className="block font-semibold mb-1">Mensaje</label>
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el contenido del mensaje"
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div>
        <label className="block font-semibold mb-1">Receptores</label>
        <label className="inline-flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={sendToAll}
            onChange={() => setSendToAll(!sendToAll)}
          />
          Enviar a todos los trabajadores
        </label>

        {!sendToAll && (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border p-2 rounded">
            {users.map((user) => (
              <label key={user._id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={user._id}
                  checked={selectedIds.includes(user._id)}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedIds((prev) =>
                      prev.includes(id)
                        ? prev.filter((uid) => uid !== id)
                        : [...prev, id]
                    );
                  }}
                />
                {user.lastName}, {user.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t mt-4">
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition w-full sm:w-auto"
        >
          Enviar mensaje
        </button>

        <button
          onClick={() => navigate('/admin/messages/sent')}
          className="text-blue-600 font-medium underline hover:text-blue-800 transition text-sm"
        >
          📨 Ver mensajes enviados
        </button>
      </div>
    </div>
  </div>
);

};

export default AdminMessagesPage;
