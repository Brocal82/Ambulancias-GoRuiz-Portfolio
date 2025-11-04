// frontend/src/pages/AdminUserMessageTab.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendMessage, sendMessageMultipart } from '../api/messages';
import { toastT } from "../utils/toast";
import { useTranslation } from 'react-i18next';
import FileUpload from '../components/common/FileUpload';

interface Props {
  userId: string;
}

const AdminUserMessageTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Adjunto (opcional) y clave para resetear el FileUpload
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

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
      setUploadKey(k => k + 1); // fuerza remount del FileUpload para limpiar UI
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

      {/* Adjunto (reutilizando FileUpload) */}
      <div className="flex flex-col space-y-2">
        <FileUpload
          key={uploadKey} // para resetear tras enviar
          id="admin-user-msg-attachment"
          label={t('pages.messages.adminPage.actions.attach') || 'Adjuntar archivo'}
          hintWhenEmpty={t('pages.messages.adminPage.attachmentHelp') || 'PDF, JPG o PNG. Máx 5MB.'}
          accept=".pdf,image/jpeg,image/png"
          maxSizeMB={5}
          onFileSelect={(file) => setAttachment(file)}
          onError={(msg) => toastT.warn([msg])}
        />
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
