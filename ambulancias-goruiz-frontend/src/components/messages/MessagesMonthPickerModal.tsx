// frontend/src/components/messages/MessagesMonthPickerModal.tsx
import React, { useMemo } from "react";
import type { Message } from "../../types/message";
import MessageList from "./MessageList";
import MessagesYearGrid from "./MessagesYearGrid";
import { sortMessagesByDateDesc } from "../../utils/messages/sortMessagesByDateDesc";
import {
    buildCountsByMonthForYear,
    filterMessagesByYearMonth,
} from "../../utils/messages/messagesByMonth";
import { useTranslation } from "react-i18next";

type Props = {
    isOpen: boolean;
    onClose: () => void;

    /** Mensajes ya cargados (admin sent / admin per user / worker inbox) */
    messages: Message[];

    /** Para calcular unread por mes (worker). Si no aplica, pasa null/undefined */
    meId?: string | null;

    /** Año visible en el grid */
    year: number;
    setYear: (y: number) => void;

    /** Mes seleccionado 0..11 (o null si ninguno) */
    selectedMonth: number | null;
    setSelectedMonth: (m: number | null) => void;

    /** Título del modal (i18n-friendly) */
    title: string;

    /** Locale para nombres de mes (p.ej. 'es-ES', 'de-DE', 'en-US') */
    locale?: string;

    /** Lista: expansión */
    expanded: Set<string>;
    onToggle: (msg: Message) => void | Promise<void>;

    /** Lista: unread (worker) */
    isUnread?: (msg: Message) => boolean;

    /** Lista: borrar */
    showDelete?: boolean;
    onDelete?: (msg: Message) => void | Promise<void>;

    /** Opcional: botón refrescar en header */
    onRefresh?: () => void | Promise<void>;
    refreshLabel?: string;
};

const MessagesMonthPickerModal: React.FC<Props> = ({
    isOpen,
    onClose,
    messages,
    meId,
    year,
    setYear,
    selectedMonth,
    setSelectedMonth,
    title,
    locale = "es-ES",
    expanded,
    onToggle,
    isUnread,
    showDelete = false,
    onDelete,
    onRefresh,
    refreshLabel,
}) => {
    const { t } = useTranslation();

    const countsByMonth = useMemo(() => {
        return buildCountsByMonthForYear(messages, year, meId);
    }, [messages, year, meId]);

    const monthMessages = useMemo(() => {
        if (selectedMonth === null) return [];
        const filtered = filterMessagesByYearMonth(messages, year, selectedMonth);
        return sortMessagesByDateDesc(filtered);
    }, [messages, year, selectedMonth]);

    const monthTitle = useMemo(() => {
        if (selectedMonth === null) return "";
        const d = new Date(year, selectedMonth, 1);
        return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
    }, [year, selectedMonth, locale]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={() => onClose()}
        >
            <div className="absolute inset-0 bg-black/30" />

            <div
                className="relative w-full max-w-5xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50 rounded-t-2xl">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-600 truncate">{title}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                                title={refreshLabel ?? t("common.refresh", "Refrescar")}
                            >
                                ↻
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => onClose()}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-700 hover:bg-slate-100"
                            aria-label={t("common.close", "Cerrar")}
                            title={t("common.close", "Cerrar")}
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 max-h-[80vh] overflow-y-auto space-y-5">
                    {/* Grid año/mes */}
                    <MessagesYearGrid
                        year={year}
                        locale={locale}
                        selectedMonth={selectedMonth}
                        countsByMonth={countsByMonth}
                        onSelectMonth={(m) => {
                            // ✅ Toggle: mismo mes => cerrar
                            setSelectedMonth(selectedMonth === m ? null : m);
                        }}

                        onPrevYear={() => {
                            setYear(year - 1);
                            setSelectedMonth(null);
                        }}
                        onNextYear={() => {
                            setYear(year + 1);
                            setSelectedMonth(null);
                        }}
                        onThisYear={() => {
                            const now = new Date();
                            setYear(now.getFullYear());
                            setSelectedMonth(null);
                        }}
                    />

                    {/* ✅ Lista SOLO si hay un mes abierto */}
                    {selectedMonth !== null && (
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
                                        onToggle={onToggle}
                                        isUnread={isUnread}
                                        showDelete={showDelete}
                                        onDelete={onDelete}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessagesMonthPickerModal;
