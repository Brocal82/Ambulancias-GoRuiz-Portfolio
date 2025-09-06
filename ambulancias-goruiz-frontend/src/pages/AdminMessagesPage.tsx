// frontend/src/pages/AdminMessagesPage.tsx
import { useEffect, useState } from 'react';
import { getAllUsers } from '../api/users';
import { sendMessage } from '../api/messages';
import type { User } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { toastT } from "../utils/toast";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AdminMessagesPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      toastT.warn(["toasts.messages.fillRequiredRecipients"]);
      return;
    }

    try {
      await sendMessage(token!, {
        subject,
        body,
        recipients,
        toAllWorkers: sendToAll,
      });
      toastT.success(["toasts.messages.sent"]);
      setSubject('');
      setBody('');
      setSelectedIds([]);
      setSendToAll(false);
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      toastT.error(["toasts.messages.error"]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {t('pages.messages.adminPage.title')}
      </h1>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-4">
        <div>
          <label className="block font-semibold mb-1">
            {t('pages.messages.adminPage.labels.subject')}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('pages.messages.adminPage.placeholders.subject')}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">
            {t('pages.messages.adminPage.labels.body')}
          </label>
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('pages.messages.adminPage.placeholders.body')}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">
            {t('pages.messages.adminPage.labels.recipients')}
          </label>
          <label className="inline-flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={() => setSendToAll(!sendToAll)}
            />
            {t('pages.messages.adminPage.sendToAll')}
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
            {t('pages.messages.adminPage.actions.send')}
          </button>

          <button
            onClick={() => navigate('/admin/messages/sent')}
            className="text-blue-600 font-medium underline hover:text-blue-800 transition text-sm"
          >
            {t('pages.messages.adminPage.actions.viewSent')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminMessagesPage;

