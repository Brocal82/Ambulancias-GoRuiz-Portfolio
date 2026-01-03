// frontend/src/pages/WorkerMessagesPage.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  getMyMessages,
  deleteMessageForUser,
  markMessageAsRead,
} from "../api/messages";
import type { Message } from "../types/message";
import { useAuth } from "../hooks/useAuth";
import { toastT } from "../utils/toast";
import { useTranslation } from "react-i18next";
import { notifyUnreadMessagesChanged } from "../hooks/useUnreadMessagesCount";
import MessageList from "../components/messages/MessageList";
import { useMessageExpansion } from "../hooks/useMessageExpansion";



const WorkerMessagesPage = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { expanded, toggleById, setExpanded } = useMessageExpansion();


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
  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      ),
    [messages],
  );

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
                      ...((m.readBy as unknown as string[] | undefined) ||
                        []),
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6 text-center">
          {t("pages.messages.workerPage.title")}
        </h1>

        {loading ? (
          <p className="text-center text-slate-500">
            {t("pages.messages.workerPage.loading")}
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-slate-400">
            {t("pages.messages.workerPage.empty")}
          </p>
        ) : (
          <MessageList
            messages={sorted}
            expanded={expanded}
            onToggle={toggleMessage}
            isUnread={isUnread}

            showDelete
            onDelete={(msg) => handleDelete(msg._id)}
          />

        )}
      </div>
    </div>
  );
};

export default WorkerMessagesPage;
