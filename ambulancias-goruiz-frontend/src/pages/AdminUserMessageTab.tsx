// frontend/src/pages/AdminUserMessageTab.tsx
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { sendMessage, sendMessageMultipart } from "../api/messages";
import { toastT } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { getMessagesForUserAsAdmin } from "../api/messages";
import type { Message } from "../types/message";
import MessageList from "../components/messages/MessageList";

import MessageAttachmentsPicker from "../components/messages/MessageAttachmentsPicker";

interface Props {
  userId: string;
  userFullName?: string; // p.ej. "García, Juan"
}

const AdminUserMessageTab = ({ userId, userFullName }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Igual que AdminMessagesPage: múltiples adjuntos
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState(0);

  // Historial de mensajes enviados a este usuario
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ✅ Modal para ver mensajes enviados
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );

  const toggleMessage = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const historyTitle = userFullName
    ? `${t("pages.messages.userTab.historyPrefix", "Mensajes enviados a")} ${userFullName}`
    : (t("pages.messages.userTab.historyTitle") as string) ||
    "Historial de mensajes enviados";

  const fetchMessages = async () => {
    if (!token || !userId) return;
    try {
      setLoadingMessages(true);
      const data = await getMessagesForUserAsAdmin(token, userId);
      setMessages(data);
    } catch (error) {
      console.error("❌ Error al cargar mensajes de este usuario:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  const handleSend = async () => {
    if (!subject || !body) {
      toastT.warn(["toasts.messages.fillRequired"]);
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      if (attachments.length > 0) {
        // ✅ Envío con multipart/form-data (varios adjuntos)
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("body", body);
        formData.append("recipients", JSON.stringify([userId]));

        // ✅ Añadir TODOS los adjuntos como 'attachment'
        attachments.forEach((file) => {
          formData.append("attachment", file, file.name);
        });

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
      setSubject("");
      setBody("");
      setAttachments([]);
      setUploadKey((k) => k + 1); // limpia UI del FileUpload

      // 🔁 Refrescar historial tras enviar
      await fetchMessages();
    } catch (error) {
      console.error("❌ Error al enviar mensaje:", error);
      toastT.error(
        (error as any)?.response?.data?.message ||
        (t("toasts.messages.error") as string) ||
        "Error sending the message",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Card de envío */}
      <div className="rounded-xl bg-white shadow p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          {/* ✅ Título */}
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <span aria-hidden="true" className="text-gray-500">
              ✉️
            </span>

            <span className="text-gray-700 font-medium">
              {t("pages.messages.userTab.sendTo", "Enviar mensaje a")}
            </span>

            {userFullName && (
              <span className="text-gray-900 font-semibold">{userFullName}</span>
            )}
          </h2>

          {/* ✅ Carpeta arriba a la derecha (alineada con el h2) */}
          <button
            type="button"
            onClick={() => setIsMsgModalOpen(true)}
            className="
              inline-flex items-center justify-center
              w-8 h-8 rounded-full
              text-blue-700 hover:text-blue-900
              hover:bg-blue-100
              transition
            "
            title={historyTitle}
            aria-label={historyTitle}
          >
            <span className="text-xl leading-none">📂</span>
          </button>
        </div>

        {/* Asunto */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="subject" className="text-sm font-medium text-gray-700">
            {t("pages.messages.userTab.fields.subject")}
          </label>
          <input
            id="subject"
            type="text"
            placeholder={
              t("pages.messages.userTab.placeholders.subject") as string
            }
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Cuerpo */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="body" className="text-sm font-medium text-gray-700">
            {t("pages.messages.userTab.fields.body")}
          </label>
          <textarea
            id="body"
            placeholder={t("pages.messages.userTab.placeholders.body") as string}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
          />
        </div>

        {/* ✅ Adjuntos + Enviar en la misma fila (centrados) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {/* Adjuntos */}
          <div className="flex-1">
            <MessageAttachmentsPicker
              id="admin-user-msg-attachment"
              files={attachments}
              setFiles={setAttachments}
              uploadKey={uploadKey}
              onError={(msg) => toastT.warn([msg])}
            />
          </div>


          {/* Enviar (alineado con Adjuntar) */}
          <div className="sm:pb-[2px]">
            <button
              onClick={handleSend}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 w-full sm:w-auto"
            >
              {loading
                ? (t("pages.messages.userTab.actions.sending") as string)
                : (t("pages.messages.userTab.actions.send") as string)}
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Modal de mensajes enviados */}
      {isMsgModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={historyTitle}
          onClick={() => setIsMsgModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />

          <div
            className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50 rounded-t-2xl">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-600 truncate">
                  {historyTitle}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchMessages()}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  title={t("common.refresh", "Refrescar")}
                >
                  ↻
                </button>

                <button
                  type="button"
                  onClick={() => setIsMsgModalOpen(false)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-700 hover:bg-slate-100"
                  aria-label={t("common.close", "Cerrar")}
                  title={t("common.close", "Cerrar")}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {loadingMessages ? (
                <p className="text-sm text-slate-500">
                  {t("pages.messages.userTab.loadingHistory") ||
                    "Cargando mensajes..."}
                </p>
              ) : sortedMessages.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {t("pages.messages.userTab.emptyHistory") ||
                    "Todavía no hay mensajes para este trabajador."}
                </p>
              ) : (
                <MessageList
                  messages={sortedMessages}
                  expanded={expanded}
                  onToggle={(msg) => toggleMessage(msg._id)}
                />


              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserMessageTab;
