import React from "react";

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
    lines?: DienstDayCellLines;
    onOpen: () => void;
};

export const DienstDayCell: React.FC<DienstDayCellProps> = ({
    statusClass,
    incompleteBorderClass,
    isPast,
    isDisabled,
    lines,
    onOpen,
}) => {
    const disabled = Boolean(isPast || isDisabled);

    // 🌴 Día libre = solo hay ambulanceLine
    const isFreeDay =
        lines?.ambulanceLine &&
        !lines?.timeLine &&
        !lines?.driverLine &&
        !lines?.medicLine;

    // 🔒 UNA sola línea, sin saltos, con …
    const lineCls =
        "text-xs text-slate-700 flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis";

    /**
     * 🎯 Regla clara de UI:
     * - Si el día es pasado → border neutro (no estado)
     * - Si no → border normal (incompleto / estado)
     */
    const finalBorderClass = isPast
        ? "border border-slate-200"
        : incompleteBorderClass ?? "border border-transparent";

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
        ${disabled
                    ? // ⬇️ un poco MÁS apagado que antes, pero legible
                    "bg-slate-50 text-slate-400 opacity-70 grayscale-[40%] cursor-not-allowed"
                    : "hover:shadow-sm hover:-translate-y-0.5"
                }
      `}
        >
            {/* 📅 Fecha — siempre arriba */}
            {lines?.dateLine && (
                <div className="text-xs font-semibold text-slate-800 text-center mb-2">
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
