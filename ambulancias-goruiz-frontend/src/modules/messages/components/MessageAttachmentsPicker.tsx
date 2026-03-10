// src/modules/messages/components/MessageAttachmentsPicker.tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import FileUpload from "../../../components/common/FileUpload";
type Props = {
    id: string;
    files: File[];
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    uploadKey?: number; // opcional: para forzar remount si quieres limpiar UI
    label?: string;
    hint?: string;
    accept?: string;
    maxSizeMB?: number;
    onError?: (msg: string) => void; // ✅ nuevo
};


const MessageAttachmentsPicker = ({
    id,
    files,
    setFiles,
    uploadKey,
    label,
    hint,
    accept = ".pdf,image/jpeg,image/png",
    maxSizeMB = 5,
    onError,
}: Props) => {

    const { t } = useTranslation();

    const resolvedLabel =
        label ?? t("pages.messages.adminPage.actions.attach") ?? "Adjuntar archivo";

    const resolvedHint =
        hint ??
        t("pages.messages.adminPage.attachmentHelp") ??
        "PDF, JPG o PNG. Máx 5MB.";

    const hasFiles = files.length > 0;

    const key = useMemo(() => (typeof uploadKey === "number" ? uploadKey : undefined), [uploadKey]);

    return (
        <div className="space-y-2">
            <FileUpload
                key={key}
                id={id}
                label={resolvedLabel}
                hintWhenEmpty={resolvedHint}
                accept={accept}
                multiple
                maxSizeMB={maxSizeMB}
                showSelectedList={false}
                onFilesSelect={(incomingFiles) => {
                    const incoming = incomingFiles || [];
                    setFiles((prev) => {
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
                onError={(msg) => onError?.(msg)}

            />

            {hasFiles && (
                <ul className="mt-2 flex flex-wrap justify-start gap-2">
                    {files.map((file, idx) => (
                        <li
                            key={file.name + file.size + file.lastModified}
                            className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs"
                            title={file.name}
                        >
                            <span aria-hidden="true" className="mr-1">
                                📎
                            </span>
                            <span className="truncate max-w-[220px]">{file.name}</span>
                            <button
                                type="button"
                                aria-label={t("common.remove", "Quitar")}
                                className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                                onClick={() =>
                                    setFiles((prev) => {
                                        const copy = [...prev];
                                        copy.splice(idx, 1);
                                        return copy;
                                    })
                                }
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <p className="mt-1 text-[11px] text-slate-500">{resolvedHint}</p>
        </div>
    );
};

export default MessageAttachmentsPicker;
