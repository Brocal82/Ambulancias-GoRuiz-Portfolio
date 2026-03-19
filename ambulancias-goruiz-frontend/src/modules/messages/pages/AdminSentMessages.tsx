// src/modules/messages/pages/AdminSentMessages.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getSentMessages, deleteMessage } from "../domain/api";
import type { Message } from "../domain/types";
import { useNavigate } from "react-router-dom";
import { toastT } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import MessageList from "../components/MessageList";
import { useMessageExpansion } from "../hooks/useMessageExpansion";
import { sortMessagesByDateDesc } from "../utils/sortMessagesByDateDesc";
import MessagesYearGrid from "../components/MessagesYearGrid";
import {
  filterMessagesByYearMonth,
  buildCountsByMonthForYear,
} from "../utils/messagesByMonth";

const AdminSentMessages = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const { expanded, toggleById, setExpanded } = useMessageExpansion();

  const [year, setYear] = useState<number>(new Date().getFullYear());

  // ✅ Ningún mes abierto por defecto (lista oculta)
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  // ⭐ Auto-scroll arriba al cargar la página
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const fetchMessages = async () => {
    if (!token) return;
    try {
      const sentMessages = await getSentMessages();
      setMessages(sentMessages);
    } catch (error) {
      console.error("❌ Error al cargar mensajes enviados:", error);
    }
  };

  useEffect(() => {
    void fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const countsByMonth = useMemo(() => {
    return buildCountsByMonthForYear(messages, year, null);
  }, [messages, year]);

  const monthMessages = useMemo(() => {
    if (openMonth === null) return [];
    const filtered = filterMessagesByYearMonth(messages, year, openMonth);
    return sortMessagesByDateDesc(filtered);
  }, [messages, year, openMonth]);

  const monthTitle = useMemo(() => {
    if (openMonth === null) return "";
    const d = new Date(year, openMonth, 1);
    return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }, [year, openMonth]);

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
      await deleteMessage(id);
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
        t("pages.messages.sentPage.deleteError") || "Error deleting the message",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("pages.messages.sentPage.title")}
        </h1>

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
            {t("pages.messages.sentPage.actions.back")}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-5">
        {/* Grid 12 meses */}
        <MessagesYearGrid
          year={year}
          locale="es-ES"
          selectedMonth={openMonth}
          countsByMonth={countsByMonth}
          onSelectMonth={(m) => {
            // ✅ toggle: si clicas el mismo mes, cierras
            setOpenMonth((prev) => (prev === m ? null : m));
            setExpanded(new Set());
          }}
          onPrevYear={() => {
            setYear(year - 1);
            setOpenMonth(null);
            setExpanded(new Set());
          }}
          onNextYear={() => {
            setYear(year + 1);
            setOpenMonth(null);
            setExpanded(new Set());
          }}
          onThisYear={() => {
            const now = new Date();
            setYear(now.getFullYear());
            setOpenMonth(null);
            setExpanded(new Set());
          }}
        />

        {/* Lista SOLO si hay un mes abierto */}
        {openMonth !== null && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {monthMessages.length === 0 ? (
              <p className="text-sm text-slate-400">
                {t(
                  "pages.messages.monthGrid.emptyMonth",
                  "No hay mensajes en este mes.",
                )}
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-800 capitalize">
                    {t("pages.messages.monthGrid.monthTitle", "Mensajes de")}{" "}
                    {monthTitle}
                  </h4>
                </div>

                <MessageList
                  messages={monthMessages}
                  expanded={expanded}
                  onToggle={(msg) => toggleById(msg._id)}
                  showDelete
                  onDelete={(msg) => handleDelete(msg._id)}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSentMessages;
