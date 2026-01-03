// frontend/src/pages/AdminUserMessageTab.tsx
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { sendMessage, sendMessageMultipart } from "../api/messages";
import { toastT } from "../utils/toast";
import { useTranslation } from "react-i18next";
import FileUpload from "../components/common/FileUpload";
import AttachmentChips from "../components/messages/AttachmentChips";
import { getMessagesForUserAsAdmin } from "../api/messages";
import type { Message } from "../types/message";
import { buildAttachmentUrl } from "../utils/messages/buildAttachmentUrl";
import { format } from "date-fns";

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
          <div className="flex-1 space-y-2">
            <FileUpload
              key={uploadKey}
              id="admin-user-msg-attachment"
              label={
                t("pages.messages.adminPage.actions.attach") || "Adjuntar archivo"
              }
              hintWhenEmpty={
                t("pages.messages.adminPage.attachmentHelp") ||
                "PDF, JPG o PNG. Máx 5MB."
              }
              accept=".pdf,image/jpeg,image/png"
              multiple
              maxSizeMB={5}
              showSelectedList={false}
              onFilesSelect={(files) => {
                const incoming = files || [];
                setAttachments((prev) => {
                  const merged = [...prev];
                  for (const f of incoming) {
                    const dup = merged.some(
                      (e) =>
                        e.name === f.name &&
                        e.size === f.size &&
                        e.lastModified === f.lastModified,
                    );
                    if (!dup) merged.push(f);
                  }
                  return merged;
                });
              }}
              onError={(msg) => toastT.warn([msg])}
            />

            <AttachmentChips
              items={attachments.map((f) => ({
                key: f.name + f.size + f.lastModified,
                name: f.name,
                title: f.name,
              }))}
              onRemove={(idx) =>
                setAttachments((prev) => {
                  const copy = [...prev];
                  copy.splice(idx, 1);
                  return copy;
                })
              }
            />


            <p className="mt-1 text-[11px] text-slate-500">
              {t("pages.messages.adminPage.attachmentHelp") ||
                "PDF, JPG o PNG. Máx 5MB."}
            </p>
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
                <ul className="space-y-3">
                  {sortedMessages.map((msg) => {
                    const isOpen = expanded.has(msg._id);
                    const btnId = `admin-user-msg-toggle-${msg._id}`;
                    const panelId = `admin-user-msg-panel-${msg._id}`;

                    return (
                      <li
                        key={msg._id}
                        className={[
                          "relative rounded-xl ring-1 transition overflow-hidden bg-white",
                          isOpen
                            ? "ring-slate-300 shadow-sm"
                            : "ring-slate-200 hover:ring-slate-300",
                        ].join(" ")}
                      >
                        <button
                          id={btnId}
                          type="button"
                          onClick={() => toggleMessage(msg._id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left cursor-pointer select-none hover:bg-slate-50 transition-colors duration-150"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-slate-300"
                            aria-hidden="true"
                          />

                          <span className="text-xs text-slate-600">
                            {t("pages.messages.workerPage.from") || "From"}{" "}
                            <span className="font-medium">
                              {msg.sender?.lastName}, {msg.sender?.name}
                            </span>{" "}
                            · {format(new Date(msg.sentAt), "dd/MM/yyyy HH:mm")}
                          </span>

                          <span
                            className="ml-auto truncate text-xs font-medium text-slate-700"
                            title={msg.subject}
                          >
                            {msg.subject}
                          </span>

                          <span
                            className={[
                              "ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-sm transition-transform",
                              isOpen
                                ? "rotate-180 text-blue-600"
                                : "rotate-0 text-slate-500",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        </button>

                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={btnId}
                          hidden={!isOpen}
                          className="px-4 pb-3 pt-1 border-t border-slate-100"
                        >
                          <p className="mt-1 text-slate-700 text-xs whitespace-pre-line">
                            {msg.body}
                          </p>

                          {msg.attachments?.length ? (
                            <div className="mt-2">
                              <h4 className="text-xs font-medium text-slate-700">
                                {t("pages.messages.workerPage.attachments") ||
                                  "Attachments"}
                              </h4>

                              <ul className="mt-1 flex flex-wrap justify-start gap-2">
                                {msg.attachments.map((att) => (
                                  <li
                                    key={att.filename}
                                    className="inline-flex items-center"
                                  >
                                    <a
                                      href={buildAttachmentUrl(att, msg.sentAt)}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserMessageTab;
