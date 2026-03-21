import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import { getMessagesForUserAsAdmin } from "../domain/api";
import type { Message } from "../domain/types";
import MessageAttachmentsPicker from "./MessageAttachmentsPicker";
import { useMessageExpansion } from "../hooks/useMessageExpansion";
import { useSendMessage } from "../hooks/useSendMessage";
import { sortMessagesByDateDesc } from "../utils/sortMessagesByDateDesc";
import MessagesMonthPickerModal from "./MessagesMonthPickerModal";
import SendMessageButton from "./SendMessageButton";
import { useMessagesChanged } from "../hooks/useMessagesChanged";
import { emitMessagesChanged } from "../utils/messageEvents";
interface Props {
  userId: string;
  userFullName?: string; // p.ej. "García, Juan"
}

const AdminUserMessageTab = ({ userId, userFullName }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { send, loading } = useSendMessage();

  // ✅ Igual que AdminMessagesPage: múltiples adjuntos
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState(0);

  // Historial de mensajes enviados a este usuario
  const [messages, setMessages] = useState<Message[]>([]);

  const { expanded, toggleById, setExpanded } = useMessageExpansion();

  // ✅ Modal para ver mensajes enviados
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);

  // ✅ Año/mes (grid)
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // ✅ oculto por defecto (misma UX que Worker/AdminSent)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const sortedMessages = useMemo(
    () => sortMessagesByDateDesc(messages),
    [messages],
  );

  const historyTitle = userFullName
    ? `${t("pages.messages.userTab.historyPrefix", "Mensajes enviados a")} ${userFullName}`
    : (t("pages.messages.userTab.historyTitle") as string) ||
    "Historial de mensajes enviados";

  const fetchMessages = async () => {
    if (!token || !userId) return;
    try {
      const data = await getMessagesForUserAsAdmin(userId);
      setMessages(data);
    } catch (error) {
      console.error("❌ Error al cargar mensajes de este usuario:", error);
    }
  };
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useMessagesChanged(() => void fetchMessagesRef.current?.());

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

    const res = await send({
      token,
      subject,
      body,
      recipients: [userId],
      attachments,
    });

    if (!res.ok) return;

    setSubject("");
    setBody("");
    setAttachments([]);
    setUploadKey((k) => k + 1); // limpia UI del picker

    // 🔁 Refrescar historial tras enviar
    await fetchMessages();
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!token) return;

    if (
      !window.confirm(
        t("pages.messages.sentPage.confirmDelete") ||
        "Are you sure you want to delete this message?",
      )
    ) {
      return;
    }

    try {
      // ✅ borra en BD (admin)
      const { deleteMessage } = await import("../domain/api");
      await deleteMessage(messageId);
      emitMessagesChanged();

      // ✅ quita del estado local (sin refetch obligatorio)
      setMessages((prev) => prev.filter((m) => m._id !== messageId));

      // ✅ si estaba expandido, lo cerramos
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });

      toastT.success(t("pages.messages.sentPage.deleted") || "Message deleted");
    } catch (error) {
      console.error("❌ Error deleting message:", error);
      toastT.error(
        t("pages.messages.sentPage.deleteError") || "Error deleting the message",
      );
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

          {/* ✅ Carpeta arriba a la derecha */}
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setYear(now.getFullYear());
              setSelectedMonth(null); // ✅ lista oculta por defecto
              setExpanded(new Set());
              setIsMsgModalOpen(true);
            }}
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
            placeholder={t("pages.messages.userTab.placeholders.subject") as string}
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

        {/* Adjuntos + Enviar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <MessageAttachmentsPicker
              id="admin-user-msg-attachment"
              files={attachments}
              setFiles={setAttachments}
              uploadKey={uploadKey}
              onError={(msg) => toastT.warn([msg])}
            />
          </div>

          <div className="sm:pb-[2px]">
            <SendMessageButton
              onClick={handleSend}
              disabled={loading}
              loading={loading}
              label={t("pages.messages.userTab.actions.send") as string}
              loadingLabel={t("pages.messages.userTab.actions.sending") as string}
            />

          </div>
        </div>
      </div>

      {/* ✅ Modal de mensajes enviados (Grid 12 meses + lista del mes) */}
      <MessagesMonthPickerModal
        isOpen={isMsgModalOpen}
        onClose={() => {
          setIsMsgModalOpen(false);
          setExpanded(new Set());
          setSelectedMonth(null); // ✅ al cerrar, vuelve a oculto
        }}
        title={historyTitle}
        locale="es-ES"
        messages={sortedMessages}
        meId={null}
        year={year}
        setYear={(y) => {
          setYear(y);
          setSelectedMonth(null); // ✅ al cambiar año, ocultamos lista
          setExpanded(new Set());
        }}
        selectedMonth={selectedMonth}
        setSelectedMonth={(m) => {
          // ✅ toggle: mismo mes => cerrar
          setSelectedMonth((prev) => (prev === m ? null : m));
          setExpanded(new Set());
        }}
        expanded={expanded}
        onToggle={(msg) => toggleById(msg._id)}
        showDelete
        onDelete={(msg) => handleDeleteMessage(msg._id)}
        onRefresh={() => fetchMessages()}
        refreshLabel={t("common.refresh", "Refrescar") as string}
      />
    </div>
  );
};

export default AdminUserMessageTab;
