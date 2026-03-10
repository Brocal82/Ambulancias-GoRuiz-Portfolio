// src/modules/messages/components/MessagesYearGrid.tsx
import React from "react";
import { useTranslation } from "react-i18next";

type MonthCounts = {
    total: number;
    unread: number;
};

export type MessagesCountsByMonth = Record<number, MonthCounts>; // 0..11

interface Props {
    year: number;
    locale?: string;

    /** 0..11 */
    selectedMonth?: number | null;

    /** 0..11 -> { total, unread } */
    countsByMonth?: MessagesCountsByMonth;

    onSelectMonth?: (monthIndex: number) => void;

    onPrevYear?: () => void;
    onNextYear?: () => void;
    onThisYear?: () => void;
}

const monthLabel = (locale: string, year: number, monthIndex: number) => {
    const d = new Date(year, monthIndex, 1);
    return d.toLocaleDateString(locale, { month: "long" });
};

const MessagesYearGrid: React.FC<Props> = ({
    year,
    locale = "es-ES",
    selectedMonth = null,
    countsByMonth = {},
    onSelectMonth,
    onPrevYear,
    onNextYear,
    onThisYear,
}) => {
    const { t } = useTranslation();

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    // ✅ No permitir navegar al futuro
    const maxYear = thisYear;
    const canGoNext = year < maxYear;

    const yearLabel = `${year}`;

    return (
        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
            {/* Header año + navegación */}
            <div className="mb-4 flex items-center justify-between gap-3">
                {/* Izquierda: navegación (mantenemos ancho aunque se oculte next) */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onPrevYear}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition"
                        aria-label={t("common.prevYear", "Año anterior")}
                    >
                        ‹
                    </button>

                    {/* ✅ En vez de "Este año", mostramos el año actual (ej. 2026) */}
                    <button
                        type="button"
                        onClick={onThisYear}
                        className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                        aria-label={t("common.thisYear", "Ir al año actual")}
                        title={t("common.thisYear", "Ir al año actual")}
                    >
                        {thisYear}
                    </button>

                    {/* ✅ Mantener espacio: invisible cuando no se puede ir al futuro */}
                    <button
                        type="button"
                        onClick={canGoNext ? onNextYear : undefined}
                        disabled={!canGoNext}
                        className={[
                            "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg transition",
                            canGoNext
                                ? "hover:bg-slate-50 active:scale-95"
                                : "invisible pointer-events-none",
                        ].join(" ")}
                        aria-label={t("common.nextYear", "Año siguiente")}
                    >
                        ›
                    </button>
                </div>

                {/* Centro: año */}
                <h3 className="text-lg font-semibold text-slate-800">{yearLabel}</h3>

                {/* Derecha: fecha actual */}
                <div className="hidden text-xs text-slate-500 select-none sm:block">
                    {new Date().toLocaleDateString(locale)}
                </div>
            </div>

            {/* Grid 12 meses */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, monthIdx) => {
                    const isSelected = selectedMonth === monthIdx;

                    const c = countsByMonth[monthIdx];
                    const total = c?.total ?? 0;
                    const unread = c?.unread ?? 0;

                    const isCurrent = year === thisYear && monthIdx === thisMonth;

                    const baseClasses =
                        "relative flex min-h-[72px] flex-col rounded-xl border bg-white p-3 text-left text-xs transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:shadow-sm";

                    const stateClasses = isSelected
                        ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
                        : unread > 0
                            ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50/60"
                            : isCurrent
                                ? "border-blue-300 bg-blue-100/50"
                                : "border-slate-200";



                    const label = monthLabel(locale, year, monthIdx);

                    return (
                        <button
                            key={monthIdx}
                            type="button"
                            onClick={() => onSelectMonth?.(monthIdx)}
                            className={`${baseClasses} ${stateClasses}`}
                            aria-current={isSelected ? "true" : undefined}
                            aria-label={`${label} ${year} (${total} ${t(
                                "pages.messages.monthGrid.messages",
                                "mensajes",
                            )}${unread > 0
                                ? `, ${unread} ${t(
                                    "pages.messages.monthGrid.unread",
                                    "no leídos",
                                )}`
                                : ""
                                })`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold capitalize text-slate-800">
                                    {label}
                                </span>
                            </div>

                            {/* Badges (suaves) */}
                            <div className="mt-auto flex items-center justify-between text-[10px]">
                                {/* Total: solo si hay mensajes */}
                                {total > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[1.6rem] rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-700 px-1 py-[2px]">
                                        {total}
                                    </span>
                                ) : (
                                    <span />
                                )}

                                {/* Unread: solo si aplica */}
                                {unread > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                                        <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm" />
                                        {unread}
                                    </span>
                                ) : (
                                    <span />
                                )}
                            </div>

                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MessagesYearGrid;
