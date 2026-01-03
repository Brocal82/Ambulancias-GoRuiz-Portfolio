// frontend/src/pages/AdminSentMessages.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { getSentMessages, deleteMessage } from "../api/messages";
import type { Message } from "../types/message";
import { useNavigate } from "react-router-dom";
import { toastT } from "../utils/toast";
import { useTranslation } from "react-i18next";
import MessageItem from "../components/messages/MessageItem";

const AdminSentMessages = () => {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ⭐ Auto-scroll arriba al cargar la página
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!token) return;
      try {
        const sentMessages = await getSentMessages(token);
        setMessages(sentMessages);
      } catch (error) {
        console.error("❌ Error al cargar mensajes enviados:", error);
      }
    };
    fetchMessages();
  }, [token]);

  // Orden descendente por fecha
  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      ),
    [messages],
  );

  const toggleMessage = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = async (id: string) => {
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
      await deleteMessage(id, token);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toastT.success(t("pages.messages.sentPage.deleted") || "Message deleted");
    } catch (error) {
      console.error("❌ Error deleting message:", error);
      toastT.error(
        t("pages.messages.sentPage.deleteError") ||
        "Error deleting the message",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("pages.messages.sentPage.title")}
        </h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="
    inline-flex items-center gap-2
    px-3 py-1.5
    text-xs font-medium
    text-blue-700
    rounded-md border border-blue-200
    bg-blue-50
    hover:bg-blue-100 hover:border-blue-300
    transition-colors duration-150
    focus:outline-none focus:ring-2 focus:ring-blue-300
  "
        >
          <span className="text-blue-500"></span>
          {t("pages.messages.sentPage.actions.back")}
        </button>
      </div>

      {/* Lista de mensajes */}
      <div className="max-w-4xl mx-auto">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">
            {t("pages.messages.sentPage.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((msg) => {
              const isOpen = expanded.has(msg._id);

              return (
                <MessageItem
                  key={msg._id}
                  message={msg}
                  isOpen={isOpen}
                  onToggle={() => toggleMessage(msg._id)}
                  showDelete
                  onDelete={() => handleDelete(msg._id)}
                />
              );
            })}
          </ul>

        )}
      </div>
    </div>
  );
};

export default AdminSentMessages;
