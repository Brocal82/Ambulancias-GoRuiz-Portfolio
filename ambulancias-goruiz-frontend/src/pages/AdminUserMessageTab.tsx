// frontend/src/pages/AdminUserMessageTab.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendMessage, sendMessageMultipart } from '../api/messages';
import { toastT } from "../utils/toast";
import { useTranslation } from 'react-i18next';
import FileUpload from '../components/common/FileUpload';
import { getMessagesForUserAsAdmin } from '../api/messages';
import type { Message } from '../types/message';
import { getPublicUrl } from '../utils/url';
import { format } from 'date-fns';


interface Props {
  userId: string;
  userFullName?: string; // p.ej. "García, Juan"
}


const AdminUserMessageTab = ({ userId, userFullName }: Props) => {

  const { token } = useAuth();
  const { t } = useTranslation();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Adjunto (opcional) y clave para resetear el FileUpload
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

    // Historial de mensajes enviados a este usuario
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(true);


  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  const toggleMessage = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

    // 👇 AQUÍ va historyTitle
    const historyTitle =
    userFullName
      ? `${t('pages.messages.userTab.historyPrefix', 'Mensajes enviados a')} ${userFullName}`
      : t('pages.messages.userTab.historyTitle') || 'Historial de mensajes enviados';


    useEffect(() => {
    const fetchMessages = async () => {
      if (!token || !userId) return;
      try {
        setLoadingMessages(true);
        const data = await getMessagesForUserAsAdmin(token, userId);
        setMessages(data);
      } catch (error) {
        console.error('❌ Error al cargar mensajes de este usuario:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    void fetchMessages();
  }, [token, userId]);



   const handleSend = async () => {
    if (!subject || !body) {
      toastT.warn(['toasts.messages.fillRequired']);
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

      toastT.success(['toasts.messages.sent']);
      setSubject('');
      setBody('');
      setAttachment(null);
      setUploadKey((k) => k + 1); // fuerza remount del FileUpload para limpiar UI

      // 🔁 Refrescar historial después de enviar
      try {
        const data = await getMessagesForUserAsAdmin(token, userId);
        setMessages(data);
      } catch (e) {
        console.error('⚠️ No se pudo refrescar la lista de mensajes tras enviar:', e);
      }
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Card de envío */}
      <div className="rounded-xl bg-white shadow p-6 space-y-6">
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
            hintWhenEmpty={
              t('pages.messages.adminPage.attachmentHelp') ||
              'PDF, JPG o PNG. Máx 5MB.'
            }
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

{/* Historial de mensajes enviados a este usuario */}
<div className="rounded-xl bg-white shadow">
  {/* Cabecera clicable */}
<button
  type="button"
  onClick={() => setIsHistoryOpen(prev => !prev)}
  className="
    w-full flex items-center justify-between
    px-4 py-2
    cursor-pointer select-none
    bg-slate-50 hover:bg-blue-50
    transition-colors duration-200
    border-b border-slate-200
    focus:outline-none focus:ring-2 focus:ring-blue-300
  "
  aria-expanded={isHistoryOpen}
>
  <span className="text-xs font-medium text-slate-600 transition-colors duration-200">
    {historyTitle}
  </span>

  <span
    className={`
      inline-flex items-center justify-center
      w-5 h-5 text-sm
      transition-transform duration-200
      ${isHistoryOpen ? 'rotate-180 text-blue-600' : 'rotate-0 text-slate-500'}
    `}
    aria-hidden="true"
  >
    ▾
  </span>
</button>


  {/* Contenido colapsable */}
  {isHistoryOpen && (
    <div className="border-t border-slate-100 px-4 pb-4 pt-3">
      {loadingMessages ? (
        <p className="text-sm text-slate-500">
          {t('pages.messages.userTab.loadingHistory') || 'Cargando mensajes...'}
        </p>
      ) : sortedMessages.length === 0 ? (
        <p className="text-sm text-slate-400">
          {t('pages.messages.userTab.emptyHistory') ||
            'Todavía no hay mensajes para este trabajador.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {sortedMessages.map((msg) => {
            const isOpen = expanded.has(msg._id);
            const btnId = `admin-user-msg-toggle-${msg._id}`;
            const panelId = `admin-user-msg-panel-${msg._id}`;

            return (
              <li
  key={msg._id}
  className={[
    'relative rounded-xl ring-1 transition overflow-hidden bg-white',
    isOpen
      ? 'ring-slate-300 shadow-sm'
      : 'ring-slate-200 hover:ring-slate-300',
  ].join(' ')}
>
  {/* Header / botón accesible (igual que Worker, versión compacta) */}
  <button
    id={btnId}
    type="button"
    onClick={() => toggleMessage(msg._id)}
    className="w-full flex items-center gap-2 px-4 py-2 text-left cursor-pointer select-none hover:bg-slate-50 transition-colors duration-150"
    aria-expanded={isOpen}
    aria-controls={panelId}
  >
    {/* dot gris (admin no tiene leído/no leído) */}
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-slate-300"
      aria-hidden="true"
    />

    {/* fecha + remitente */}
    <span className="text-xs text-slate-600">
      {t('pages.messages.workerPage.from') || 'From'}{' '}
      <span className="font-medium">
        {msg.sender?.lastName}, {msg.sender?.name}
      </span>{' '}
      · {format(new Date(msg.sentAt), 'dd/MM/yyyy HH:mm')}
    </span>

    {/* asunto a la derecha */}
    <span
      className="ml-auto truncate text-xs font-medium text-slate-700"
      title={msg.subject}
    >
      {msg.subject}
    </span>

    {/* chevron por mensaje */}
    <span
      className={[
        'ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-sm transition-transform',
        isOpen ? 'rotate-180 text-blue-600' : 'rotate-0 text-slate-500',
      ].join(' ')}
      aria-hidden="true"
    >
      ▾
    </span>
  </button>

  {/* Panel desplegable */}
  <div
    id={panelId}
    role="region"
    aria-labelledby={btnId}
    hidden={!isOpen}
    className="px-4 pb-3 pt-1 border-t border-slate-100"
  >
    {/* Cuerpo */}
    <p className="mt-1 text-slate-700 text-xs whitespace-pre-line">
      {msg.body}
    </p>

    {/* Adjuntos (mismo estilo que WorkerMessagesPage) */}
    {msg.attachments?.length ? (
      <div className="mt-2">
        <h4 className="text-xs font-medium text-slate-700">
          {t('pages.messages.workerPage.attachments') || 'Attachments'}
        </h4>

        <ul className="mt-1 flex flex-wrap justify-start gap-2">
          {msg.attachments.map((att) => (
            <li
              key={att.filename}
              className="inline-flex items-center"
            >
              <a
                href={`${getPublicUrl(att.url)}?v=${encodeURIComponent(
                  att.filename
                )}-${encodeURIComponent(msg.sentAt)}`}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] hover:bg-slate-100"
                title={att.originalName}
              >
                <span aria-hidden="true" className="mr-1">
                  📎
                </span>
                <span className="truncate max-w-[180px]">
                  {att.originalName}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
</li>

            );
          })}
        </ul>
      )}
    </div>
  )}
</div>


    </div>
  );

};

export default AdminUserMessageTab;
