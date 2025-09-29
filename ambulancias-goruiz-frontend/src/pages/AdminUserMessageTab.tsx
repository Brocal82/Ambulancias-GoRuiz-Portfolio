// frontend/src/pages/AdminUserMessageTab.tsx
import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendMessage, sendMessageMultipart } from '../api/messages';
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

  // 👇 adjunto (opcional)
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = async () => {
    if (!subject || !body) {
      toastT.warn(["toasts.messages.fillRequired"]);
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      if (attachment) {
        // Envío con multipart/form-data
        const formData = new FormData();
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('recipients', JSON.stringify([userId]));
        formData.append('attachment', attachment, attachment.name);

        await sendMessageMultipart(token, formData);
      } else {
        // Envío JSON clásico
        await sendMessage(token, {
          subject,
          body,
          recipients: [userId],
        });
      }

      toastT.success(["toasts.messages.sent"]);
      setSubject('');
      setBody('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      toastT.error(
        (error as any)?.response?.data?.message ||
        (t('toasts.messages.error') as string) ||
        'Error sending the message'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto rounded-xl bg-white shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">
        {t('pages.messages.userTab.title')}
      </h2>

      {/* Asunto */}
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

      {/* Cuerpo */}
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

      {/* Adjunto (clip button) */}
      <div className="flex flex-col space-y-2">
        {/* input oculto accesible */}
        <input
          id="attachment"
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png"
          className="sr-only"
          title={t('pages.messages.adminPage.actions.attach') || 'Attach file'}
          aria-label={t('pages.messages.adminPage.actions.attach') || 'Attach file'}
          aria-describedby="attachment-help-user"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (!file) {
              setAttachment(null);
              return;
            }
            const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
            if (!allowed.includes(file.type)) {
              toastT.warn(['toasts.messages.invalidFileType']);
              e.currentTarget.value = '';
              setAttachment(null);
              return;
            }
            const maxBytes = 5 * 1024 * 1024; // 5MB
            if (file.size > maxBytes) {
              toastT.warn(['toasts.messages.fileTooLarge']);
              e.currentTarget.value = '';
              setAttachment(null);
              return;
            }
            setAttachment(file);
          }}
        />

        {/* Botón con icono de clip */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 w-fit"
        >
          📎
          <span className="ml-2 text-sm">
            {attachment
              ? attachment.name
              : t('pages.messages.adminPage.actions.attach') || 'Attach file'}
          </span>
        </button>

        <p id="attachment-help-user" className="text-xs text-slate-500">
          {t('pages.messages.adminPage.attachmentHelp') || 'PDF, JPG or PNG. Max 5MB.'}
        </p>
      </div>

      {/* Acciones */}
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
