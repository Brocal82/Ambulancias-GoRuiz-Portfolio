//src/modules/messages/components/MessageItem.tsx
import type { Message } from "../domain/types";
import { format } from "date-fns";
import { openSecureFile } from "../../../utils/openSecureFile";
import { useTranslation } from "react-i18next";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";

interface Props {
    message: Message;
    isOpen: boolean;
    onToggle: () => void | Promise<void>;   // ✅ aquí
    unread?: boolean;
    onDelete?: () => void | Promise<void>;  // ✅ aquí
    showDelete?: boolean;
}


const MessageItem = ({
    message,
    isOpen,
    onToggle,
    unread = false,
    onDelete,
    showDelete = false,
}: Props) => {
    const { t } = useTranslation();

    const btnId = `msg-toggle-${message._id}`;
    const panelId = `msg-panel-${message._id}`;

    return (
        <li
            className={[
                "relative rounded-xl ring-1 transition overflow-hidden bg-white",
                isOpen
                    ? "ring-slate-300 shadow-sm"
                    : "ring-slate-200 hover:ring-slate-300",
            ].join(" ")}
        >
            {/* Header */}
            <button
                id={btnId}
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 transition-colors duration-150"
                aria-expanded={isOpen}
                aria-controls={panelId}
            >
                {/* Dot */}
                <span
                    className={[
                        "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0",
                        unread ? "bg-red-500" : "bg-slate-300",
                    ].join(" ")}
                    aria-hidden="true"
                />

                {/* Sender + date */}
                <span className="text-xs text-slate-600">
                    {t("pages.messages.workerPage.from", "From")}{" "}
                    <span className="font-medium">
                        {message.sender?.lastName}, {message.sender?.name}
                    </span>{" "}
                    · {format(new Date(message.sentAt), "dd/MM/yyyy HH:mm")}
                </span>

                {/* Subject */}
                <span
                    className={[
                        "ml-auto truncate text-xs",
                        unread
                            ? "font-bold text-slate-900"
                            : "font-semibold text-slate-800",
                    ].join(" ")}
                    title={message.subject}
                >
                    {message.subject}
                </span>

                {/* Chevron */}
                <span
                    className={[
                        "ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-sm transition-transform",
                        isOpen ? "rotate-180" : "rotate-0",
                    ].join(" ")}
                    aria-hidden="true"
                >
                    ▾
                </span>
            </button>

            {/* Panel */}
            <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                hidden={!isOpen}
                className="px-4 pb-3 pt-1 border-t border-slate-100"
            >
                {/* Delete */}
                {showDelete && onDelete && (
                    <div className="flex items-center justify-end mb-2">
                        <DeleteIconButton
                            onClick={onDelete}
                            title={t("common.delete", "Eliminar") as string}
                            aria-label={t("common.delete", "Eliminar") as string}
                        />
                    </div>
                )}



                {/* Body */}
                <p className="mt-1 text-slate-700 text-xs whitespace-pre-line">
                    {message.body}
                </p>

                {/* Attachments */}
                {message.attachments?.length ? (
                    <div className="mt-2">
                        <h3 className="text-xs font-medium text-slate-700">
                            {t("pages.messages.workerPage.attachments", "Attachments")}
                        </h3>

                        <ul className="mt-2 flex flex-wrap justify-start gap-2">
                            {message.attachments.map((att) => (
                                <li key={att.filename} className="inline-flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => openSecureFile(att.url, att.originalName)}
                                        className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] hover:bg-slate-100"
                                        title={att.originalName}
                                    >
                                        <span aria-hidden="true" className="mr-1">
                                            📎
                                        </span>
                                        <span className="truncate max-w-[180px]">
                                            {att.originalName}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>
        </li>
    );
};

export default MessageItem;
