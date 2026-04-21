// src/modules/messages/pages/AdminMessagesPage.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { UsersApi } from "../../users";
import { useSendMessage } from "../hooks/useSendMessage";
import type { User } from "../../users";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import MessageAttachmentsPicker from "../components/MessageAttachmentsPicker";

import { getSentMessages, deleteMessage } from "../domain/api";
import type { Message } from "../domain/types";
import { useMessageExpansion } from "../hooks/useMessageExpansion";
import { sortMessagesByDateDesc } from "../utils/sortMessagesByDateDesc";
import MessagesMonthPickerModal from "../components/MessagesMonthPickerModal";
import RecipientsPicker from "../components/RecipientsPicker";
import SendIconButton from "../../../components/common/actions/SendIconButton";
import { useMessagesChanged } from "../hooks/useMessagesChanged";
import { emitMessagesChanged } from "../utils/messageEvents";

const AdminMessagesPage = () => {
  const { token } = useAuth();
  const { send, loading } = useSendMessage();
  const { t } = useTranslation();

  const [users, setUsers] = useState<User[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [search, setSearch] = useState(""); // buscar trabajador

  // ✅ Modal + mensajes enviados (para 📂)
  const [isSentModalOpen, setIsSentModalOpen] = useState(false);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const { expanded, toggleById, setExpanded } = useMessageExpansion();
  const [sentYear, setSentYear] = useState<number>(new Date().getFullYear());
  const [sentMonth, setSentMonth] = useState<number | null>(null);
  const canSend =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (sendToAll || selectedIds.length > 0);



  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      try {
        const data = await UsersApi.getAllUsers();
        const workersOnly = data.filter((user) => user.role === "worker");
        setUsers(workersOnly);
      } catch (error) {
        console.error("❌ Error al cargar usuarios:", error);
      }
    };

    void fetchUsers();
  }, [token]);


  const handleSend = async () => {
    if (!token) return;

    const recipients = sendToAll ? users.map((u) => u._id) : selectedIds;

    if (!subject || !body || recipients.length === 0) {
      toastT.warn(["toasts.messages.fillRequiredRecipients"]);
      return;
    }

    const res = await send({
      token,
      subject,
      body,
      recipients,
      toAllWorkers: sendToAll,
      attachments,
    });

    if (!res.ok) return;

    setSubject("");
    setBody("");
    setSelectedIds([]);
    setSendToAll(false);
    setAttachments([]);
    setSearch("");
  };

  const fetchSentMessages = async () => {
    if (!token) return;
    try {
      const data = await getSentMessages();
      setSentMessages(data);
    } catch (error) {
      console.error("❌ Error al cargar mensajes enviados:", error);
    }
  };
  const fetchSentMessagesRef = useRef(fetchSentMessages);
  fetchSentMessagesRef.current = fetchSentMessages;

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useMessagesChanged(() => void fetchSentMessagesRef.current?.());

  const openSentModal = async () => {
    setSentMonth(null);      // ✅ abre sin mes seleccionado
    setExpanded(new Set());  // ✅ opcional: sin expansiones abiertas
    setIsSentModalOpen(true);
    await fetchSentMessages();
  };
  ;

  const sortedSentMessages = useMemo(
    () => sortMessagesByDateDesc(sentMessages),
    [sentMessages],
  );

  const handleDeleteSent = async (id: string) => {
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
      await deleteMessage(id);
      emitMessagesChanged();

      setSentMessages((prev) => prev.filter((m) => m._id !== id));

      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6 text-center">
          {t("pages.messages.adminPage.title")}
        </h1>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 space-y-6">
          {/* Header interno: h2 + 📂 (como AdminUserMessageTab) */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <span aria-hidden="true" className="text-gray-500">
                ✉️
              </span>
              <span className="text-gray-700 font-medium">
                {t("pages.messages.adminPage.sendTitle", "Enviar mensajes")}
              </span>
            </h2>

            <button
              type="button"
              onClick={openSentModal}
              className="
        inline-flex items-center justify-center
        w-8 h-8 rounded-full
        text-blue-700 hover:text-blue-900
        hover:bg-blue-100
        transition
      "
              title={t("pages.messages.adminPage.actions.viewSent")}
              aria-label={t("pages.messages.adminPage.actions.viewSent")}
            >
              <span className="text-xl leading-none">📂</span>
            </button>
          </div>

          {/* Asunto */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t("pages.messages.adminPage.labels.subject")}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("pages.messages.adminPage.placeholders.subject")}
              className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Cuerpo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t("pages.messages.adminPage.labels.body")}
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("pages.messages.adminPage.placeholders.body")}
              className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 resize-y"
            />
          </div>

          {/* Adjunto */}
          <MessageAttachmentsPicker
            id="admin-message-attachment"
            files={attachments}
            setFiles={setAttachments}
          />

          {/* Destinatarios (UX escalable) */}
          <RecipientsPicker
            users={users}
            search={search}
            setSearch={setSearch}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            sendToAll={sendToAll}
            setSendToAll={setSendToAll}
            maxResults={12}
          />

          {/* Acciones */}
          <div className="flex justify-end pt-4">
            <SendIconButton
              onClick={handleSend}
              disabled={!canSend || loading}
              title={t("pages.messages.adminPage.actions.send") as string}
            />



          </div>

        </div>

      </div>

      {/* ✅ Modal de enviados por mes */}
      <MessagesMonthPickerModal
        isOpen={isSentModalOpen}
        onClose={() => {
          setIsSentModalOpen(false);
          setExpanded(new Set());
        }}
        title={t("pages.messages.sentPage.title", "Mensajes enviados") as string}
        locale="es-ES"

        messages={sortedSentMessages}
        meId={null}
        year={sentYear}
        setYear={setSentYear}
        selectedMonth={sentMonth}
        setSelectedMonth={setSentMonth}
        expanded={expanded}
        onToggle={(msg) => toggleById(msg._id)}
        showDelete
        onDelete={(msg) => handleDeleteSent(msg._id)}
        onRefresh={() => fetchSentMessages()}
        refreshLabel={t("common.refresh", "Refrescar") as string}
      />
    </div>
  );
};

export default AdminMessagesPage;
