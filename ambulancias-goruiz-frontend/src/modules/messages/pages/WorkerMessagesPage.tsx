// src/modules/messages/pages/WorkerMessagesPage.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  getMyMessages,
  deleteMessageForUser,
  markMessageAsRead,
} from "../domain/api";
import type { Message } from "../domain/types";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import { notifyUnreadMessagesChanged } from "../hooks/useUnreadMessagesCount"; import MessageList from "../components/MessageList";
import { useMessageExpansion } from "../hooks/useMessageExpansion";
import { sortMessagesByDateDesc } from "../utils/sortMessagesByDateDesc";
import MessagesYearGrid from "../components/MessagesYearGrid";
import {
  buildCountsByMonthForYear,
  filterMessagesByYearMonth,
} from "../utils/messagesByMonth";

const WorkerMessagesPage = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { expanded, toggleById, setExpanded } = useMessageExpansion();

  // ✅ Grid year/month inline
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // ✅ Ningún mes abierto por defecto (lista oculta)
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  const markedAnyAsReadRef = useRef(false);

  const meId = user?._id ? String(user._id) : null;

  // helper: ¿no leído por mí?
  const isUnread = useCallback(
    (msg: Message) => {
      if (!meId) return false;
      const readBy = (msg.readBy as unknown as string[]) || [];
      return !readBy.some((u) => String(u) === meId);
    },
    [meId],
  );

  // ordenamos por fecha desc
  const sorted = useMemo(() => sortMessagesByDateDesc(messages), [messages]);

  // ⭐ Auto-scroll arriba al cargar la página
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await getMyMessages(token!, { unreadOnly: false });
        setMessages(data);
      } catch (error) {
        console.error("❌ Error al cargar mensajes:", error);
      } finally {
        setLoading(false);
      }
    };
    if (token) void fetchMessages();
  }, [token]);

  const handleDelete = async (messageId: string) => {
    if (!token) return;
    try {
      await deleteMessageForUser(token, messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      notifyUnreadMessagesChanged();
    } catch (error) {
      console.error("❌ Error al borrar mensaje:", error);
      toastT.error(["toasts.messages.deleteError"]);
    }
  };

  const toggleMessage = useCallback(
    async (msg: Message) => {
      const id = msg._id;

      toggleById(id);

      // si se abre por primera vez y estaba no leído → marcar como leído
      const wasExpanded = expanded.has(id);
      if (!wasExpanded && token && meId && isUnread(msg)) {
        try {
          await markMessageAsRead(token, id);
          markedAnyAsReadRef.current = true;
          notifyUnreadMessagesChanged();
          // actualizar estado local: añadir mi id a readBy
          setMessages((prev) =>
            prev.map((m) =>
              m._id === id
                ? {
                  ...m,
                  readBy: Array.from(
                    new Set([
                      ...((m.readBy as unknown as string[] | undefined) || []),
                      meId,
                    ]),
                  ) as unknown as Message["readBy"],
                }
                : m,
            ),
          );
        } catch (error) {
          console.error("❌ Error al marcar como leído:", error);
        }
      }
    },
    [expanded, token, meId, isUnread, toggleById],
  );

  // al salir de la página, por si hubo varias lecturas rápidas
  useEffect(() => {
    return () => {
      if (markedAnyAsReadRef.current) notifyUnreadMessagesChanged();
    };
  }, []);

  const countsByMonth = useMemo(() => {
    // ✅ usamos messages (no sorted) porque la cuenta no depende del orden
    return buildCountsByMonthForYear(messages, year, meId);
  }, [messages, year, meId]);

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-center">
          {t("pages.messages.workerPage.title")}
        </h1>

        {/* ✅ Grid 12 meses + navegación año (SIEMPRE visible) */}
        <MessagesYearGrid
          year={year}
          locale="es-ES"
          selectedMonth={openMonth}
          countsByMonth={countsByMonth}
          onSelectMonth={(m) => {
            // ✅ toggle: si clicas el mismo mes, cierras
            setOpenMonth((prev) => (prev === m ? null : m));
            // cerramos expansiones al cambiar de mes (limpio)
            setExpanded(new Set());
          }}
          onPrevYear={() => {
            setYear(year - 1);
            setOpenMonth(null); // lista oculta al cambiar de año
            setExpanded(new Set());
          }}
          onNextYear={() => {
            setYear(year + 1);
            setOpenMonth(null); // lista oculta al cambiar de año
            setExpanded(new Set());
          }}
          onThisYear={() => {
            const now = new Date();
            setYear(now.getFullYear());
            setOpenMonth(null); // no auto-abrir
            setExpanded(new Set());
          }}
        />

        {/* ✅ Estado de carga / vacío (sin ocultar el grid) */}
        {loading ? (
          <p className="text-center text-slate-500">
            {t("pages.messages.workerPage.loading")}
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">
            {t("pages.messages.workerPage.empty")}
          </p>
        ) : null}

        {/* ✅ Lista SOLO si hay un mes abierto */}
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
                  onToggle={toggleMessage}
                  isUnread={isUnread}
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

export default WorkerMessagesPage;
