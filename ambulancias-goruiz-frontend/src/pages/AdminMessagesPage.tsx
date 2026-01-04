// frontend/src/pages/AdminMessagesPage.tsx
import { useEffect, useState, useMemo } from "react";
import { getAllUsers } from "../api/users";
import { useSendMessage } from "../hooks/useSendMessage";
import type { User } from "../types/user";
import { useAuth } from "../hooks/useAuth";
import { toastT } from "../utils/toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MessageAttachmentsPicker from "../components/messages/MessageAttachmentsPicker";

const AdminMessagesPage = () => {
  const { token } = useAuth();
  const { send, loading } = useSendMessage();

  const navigate = useNavigate();
  const { t } = useTranslation();

  const [users, setUsers] = useState<User[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [search, setSearch] = useState(""); // buscar trabajador

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getAllUsers(token!);
        const workersOnly = data.filter((user) => user.role === "worker");
        setUsers(workersOnly);
      } catch (error) {
        console.error("❌ Error al cargar usuarios:", error);
      }
    };

    fetchUsers();
  }, [token]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      `${u.lastName} ${u.name}`.toLowerCase().includes(term),
    );
  }, [users, search]);

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


  const totalSelected = sendToAll ? users.length : selectedIds.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6 text-center">
          {t("pages.messages.adminPage.title")}
        </h1>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 space-y-6">
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


          {/* Destinatarios */}
          <div className="space-y-2">
            {/* Título */}
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">
                {t("pages.messages.adminPage.labels.recipients")}
              </label>
            </div>

            {/* Toggle enviar a todos + contador de seleccionados */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendToAll}
                  onChange={() => setSendToAll(!sendToAll)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                />
                <span className="text-sm text-slate-700">
                  {t("pages.messages.adminPage.sendToAll")}
                </span>
              </label>

              <span className="text-[11px] text-slate-500">
                {t(
                  "pages.messages.adminPage.selectedCount",
                  "Seleccionados: {{n}}",
                  {
                    n: totalSelected,
                  },
                )}
              </span>
            </div>

            {/* Lista de trabajadores (solo si NO es "enviar a todos") */}
            {!sendToAll && (
              <div className="space-y-2">
                {/* Buscador */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      t(
                        "pages.messages.adminPage.searchPlaceholder",
                        "Buscar trabajador...",
                      ) as string
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Lista scrollable compacta */}
                <div className="rounded-xl ring-1 ring-slate-200 max-h-56 overflow-y-auto bg-slate-50/60">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-500">
                      {t(
                        "pages.messages.adminPage.noWorkersFound",
                        "No se han encontrado trabajadores.",
                      )}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-200">
                      {filteredUsers.map((user) => (
                        <li key={user._id} className="px-3 py-1.5">
                          <label className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              value={user._id}
                              checked={selectedIds.includes(user._id)}
                              onChange={(e) => {
                                const id = e.target.value;
                                setSelectedIds((prev) =>
                                  prev.includes(id)
                                    ? prev.filter((uid) => uid !== id)
                                    : [...prev, id],
                                );
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                            />
                            <span className="truncate">
                              {user.lastName}, {user.name}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200">
            {/* Botón enviar, versión mini con icono flecha */}
            <button
              onClick={handleSend}
              type="button"
              disabled={loading}
              className="
                inline-flex items-center gap-2
                rounded-full border border-blue-300 bg-blue-50
                px-4 py-1.5
                text-xs font-medium text-blue-700
                shadow-sm
                hover:bg-blue-100 hover:border-blue-400
                focus:outline-none focus:ring-2 focus:ring-blue-300
                w-full sm:w-auto justify-center
              "
            >
              <span className="text-sm">➤</span>
              <span>{t("pages.messages.adminPage.actions.send")}</span>
            </button>

            {/* Ver mensajes enviados */}
            <button
              onClick={() => navigate("/admin/messages/sent")}
              type="button"
              className="
    inline-flex items-center justify-center
    w-7 h-7 rounded-full
    text-blue-700 hover:text-blue-900
    hover:bg-blue-100
    transition
    group
  "
              title={t("pages.messages.adminPage.actions.viewSent")}
            >
              <span className="text-xl leading-none">📂</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMessagesPage;
