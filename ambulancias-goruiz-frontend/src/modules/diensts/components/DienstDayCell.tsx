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
}

export const DienstDayCell: React.FC<DienstDayCellProps> = ({
    statusClass,
    incompleteBorderClass,
    isPast,
    isDisabled,
    lines,
    onOpen,
}) => {
    const disabled = Boolean(isPast || isDisabled);

    // ✅ Clase para que las líneas largas NO rompan el layout (misma altura visual)
    const lineCls = "text-xs text-slate-700 truncate";

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
        text-left rounded-xl p-3 ring-1 transition
        ${statusClass}
        ${incompleteBorderClass ?? ""}
        ${disabled
                    ? "opacity-80 bg-slate-50 text-slate-400 cursor-not-allowed hover:shadow-none hover:translate-y-0"
                    : "hover:shadow-sm hover:-translate-y-0.5"
                }
      `}
        >
            <div className="space-y-0.5">
                {lines?.dateLine && (
                    <p className="text-xs font-semibold text-slate-800 mb-1 truncate">
                        {lines.dateLine}
                    </p>
                )}

                {lines?.timeLine && <p className={lineCls}>{lines.timeLine}</p>}
                {lines?.ambulanceLine && <p className={lineCls}>{lines.ambulanceLine}</p>}
                {lines?.driverLine && <p className={lineCls}>{lines.driverLine}</p>}
                {lines?.medicLine && <p className={lineCls}>{lines.medicLine}</p>}
            </div>
        </button>
    );
};
