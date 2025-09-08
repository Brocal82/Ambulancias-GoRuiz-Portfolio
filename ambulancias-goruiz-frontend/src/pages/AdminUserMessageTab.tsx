// frontend/src/pages/AdminUserMessageTab.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendMessage } from '../api/messages';
import { toastT } from "../utils/toast";
import { useTranslation } from 'react-i18next';

interface Props {
  userId: string;
}

const AdminUserMessageTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject || !body) {
      toastT.warn(["toasts.messages.fillRequired"]);
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

      toastT.success(["toasts.messages.sent"]);
      setSubject('');
      setBody('');
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      toastT.error(["toasts.messages.error"]);
    } finally {
      setLoading(false);
    }
  };

return (
  <div className="max-w-2xl mx-auto rounded-xl bg-white shadow p-6 space-y-6">
    <h2 className="text-lg font-semibold text-gray-800">
      {t('pages.messages.userTab.title')}
    </h2>

    <div className="flex flex-col space-y-2">
      <label htmlFor="subject" className="text-sm font-medium text-gray-700">
        {t('pages.messages.userTab.fields.subject')}
      </label>
      <input
        id="subject"
        type="text"
        placeholder={t('pages.messages.userTab.placeholders.subject')}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
    </div>

    <div className="flex flex-col space-y-2">
      <label htmlFor="body" className="text-sm font-medium text-gray-700">
        {t('pages.messages.userTab.fields.body')}
      </label>
      <textarea
        id="body"
        placeholder={t('pages.messages.userTab.placeholders.body')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
      />
    </div>

    <div className="flex justify-end">
      <button
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? t('pages.messages.userTab.actions.sending')
          : t('pages.messages.userTab.actions.send')}
      </button>
    </div>
  </div>
);
};

export default AdminUserMessageTab;
