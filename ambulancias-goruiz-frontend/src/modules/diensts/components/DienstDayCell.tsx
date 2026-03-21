import React from "react";
import {
  INCOMPLETE_BG_RING,
  INCOMPLETE_BORDER,
  INCOMPLETE_TEXT,
} from "../utils/dienstStatusStyles";

export type DienstDayCellLines = {
    dateLine?: React.ReactNode;
    timeLine?: React.ReactNode;
    ambulanceLine?: React.ReactNode;
    driverLine?: React.ReactNode;
    medicLine?: React.ReactNode;
};

export interface DienstDayCellProps {
    dayISO: string;
    statusClass: string;
    incompleteBorderClass?: string;
    isPast: boolean;
    isDisabled?: boolean;
    /** Cuando true, usa text-slate-900 para unificar admin/worker en estado incompleto */
    isPartial?: boolean;
    lines?: DienstDayCellLines;
    onOpen: () => void;
};

export const DienstDayCell: React.FC<DienstDayCellProps> = ({
    statusClass,
    incompleteBorderClass,
    isPast,
    isDisabled,
    isPartial,
    lines,
    onOpen,
}) => {
    const disabled = Boolean(isPast || isDisabled);
    const isIncomplete = Boolean(isDisabled && !isPast);
    const useIncompleteText = Boolean(isPartial || isIncomplete);

    // 🌴 Día libre = solo hay ambulanceLine
    const isFreeDay =
        lines?.ambulanceLine &&
        !lines?.timeLine &&
        !lines?.driverLine &&
        !lines?.medicLine;

    // 🔒 UNA sola línea, sin saltos, con …
    const lineCls = useIncompleteText
        ? `text-xs ${INCOMPLETE_TEXT} flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis`
        : "text-xs text-slate-700 flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis";

    /**
     * 🎯 Regla clara de UI:
     * - Si el día es pasado → border neutro (no estado)
     * - Si incompleto (disabled pero no pasado) → amarillo activo
     * - Si no → border normal (incompleto / estado)
     */
    const finalBorderClass = isPast
        ? "border border-slate-200"
        : isIncomplete
            ? INCOMPLETE_BORDER
            : incompleteBorderClass ?? "border border-transparent";

    const disabledStyle = isIncomplete
        ? `${INCOMPLETE_BG_RING} ${INCOMPLETE_TEXT} cursor-not-allowed disabled:opacity-100`
        : "bg-slate-50 text-slate-400 opacity-70 grayscale-[40%] cursor-not-allowed";

    return (
        <button
            type="button"
            disabled={disabled}
            aria-disabled={disabled}
            onClick={() => {
                if (disabled) return;
                onOpen();
            }}
            className={`
        rounded-xl p-3 ring-1 transition text-left
        flex flex-col min-h-[116px]
        ${statusClass}
        ${finalBorderClass}
        ${disabled ? disabledStyle : "hover:shadow-sm hover:-translate-y-0.5"}
      `}
        >
            {/* 📅 Fecha — siempre arriba */}
            {lines?.dateLine && (
                <div
                    className={`text-xs font-semibold text-center mb-2 ${
                        useIncompleteText ? INCOMPLETE_TEXT : "text-slate-800"
                    }`}
                >
                    {lines.dateLine}
                </div>
            )}

            {/* 🌴 Día libre centrado */}
            {isFreeDay ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className={`${lineCls} text-sm justify-center`}>
                        {lines.ambulanceLine}
                    </p>
                </div>
            ) : (
                /* 📄 Día con contenido */
                <div className="space-y-0.5 flex-1">
                    {lines?.timeLine && <p className={lineCls}>{lines.timeLine}</p>}
                    {lines?.ambulanceLine && (
                        <p className={lineCls}>{lines.ambulanceLine}</p>
                    )}
                    {lines?.driverLine && (
                        <p className={lineCls}>{lines.driverLine}</p>
                    )}
                    {lines?.medicLine && (
                        <p className={lineCls}>{lines.medicLine}</p>
                    )}
                </div>
            )}
        </button>
    );
};
