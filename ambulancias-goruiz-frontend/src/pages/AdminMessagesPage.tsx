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
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6 text-center">
        {t('pages.messages.adminPage.title')}
      </h1>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 space-y-6">
        {/* Asunto */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            {t('pages.messages.adminPage.labels.subject')}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('pages.messages.adminPage.placeholders.subject')}
            className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </div>

        {/* Cuerpo */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            {t('pages.messages.adminPage.labels.body')}
          </label>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('pages.messages.adminPage.placeholders.body')}
            className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 resize-y"
          />
        </div>

        {/* Destinatarios */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('pages.messages.adminPage.labels.recipients')}
          </label>


          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={() => setSendToAll(!sendToAll)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            />
            <span className="text-sm text-slate-700">
              {t('pages.messages.adminPage.sendToAll')}
            </span>
          </label>

          {!sendToAll && (
            <div className="rounded-xl ring-1 ring-slate-200 max-h-56 overflow-y-auto p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {users.map((user) => (
                  <label key={user._id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      value={user._id}
                      checked={selectedIds.includes(user._id)}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedIds((prev) =>
                          prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                    />
                    <span className="truncate">
                      {user.lastName}, {user.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={handleSend}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 w-full sm:w-auto"
          >
            {t('pages.messages.adminPage.actions.send')}
          </button>

          <button
            onClick={() => navigate('/admin/messages/sent')}
            className="text-sm font-medium text-blue-700 hover:text-blue-800 underline underline-offset-2"
          >
            {t('pages.messages.adminPage.actions.viewSent')}
          </button>
        </div>
      </div>
    </div>
  </div>
);

};

export default AdminMessagesPage;

