// frontend/src/pages/AdminUserMessageTab.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendMessage } from '../api/messages';
import { toast } from 'react-toastify';
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
      toast.warn(t('pages.messages.userTab.toasts.fillRequired'));
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

      toast.success(t('pages.messages.userTab.toasts.sent'));
      setSubject('');
      setBody('');
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      toast.error(t('pages.messages.userTab.toasts.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t('pages.messages.userTab.title')}
      </h2>

      <div className="flex flex-col">
        <label htmlFor="subject" className="font-medium mb-1">
          {t('pages.messages.userTab.fields.subject')}
        </label>
        <input
          id="subject"
          type="text"
          placeholder={t('pages.messages.userTab.placeholders.subject')}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor="body" className="font-medium mb-1">
          {t('pages.messages.userTab.fields.body')}
        </label>
        <textarea
          id="body"
          placeholder={t('pages.messages.userTab.placeholders.body')}
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
        {loading
          ? t('pages.messages.userTab.actions.sending')
          : t('pages.messages.userTab.actions.send')}
      </button>
    </div>
  );
};

export default AdminUserMessageTab;
