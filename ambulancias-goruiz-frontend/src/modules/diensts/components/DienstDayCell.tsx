import React, { useRef, useState } from "react";
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

/** Admin Dienst: DnD mismo documento (vacío o swap both en la misma línea). */
export type AdminDienstDndProps = {
    driverDraggable?: boolean;
    medicDraggable?: boolean;
    driverDropTarget?: boolean;
    medicDropTarget?: boolean;
    /** Zona amplia: toda la celda (misma semana / mismas reglas que líneas). */
    cellDropTarget?: boolean;
    onDragStartDriver?: (e: React.DragEvent) => void;
    onDragStartMedic?: (e: React.DragEvent) => void;
    onDragOverDriver?: (e: React.DragEvent) => void;
    onDragOverMedic?: (e: React.DragEvent) => void;
    onDragOverCell?: (e: React.DragEvent) => void;
    onDropDriver?: (e: React.DragEvent) => void;
    onDropMedic?: (e: React.DragEvent) => void;
    onDropCell?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
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
    /** Solo admin Dienst: DnD hacia PATCH (vacío o swap both en misma línea). */
    adminDnd?: AdminDienstDndProps;
    /**
     * Vista trabajador (Diensts / plan Excel): texto con salto de línea y sin `…` forzado
     * para que nombres largos y celdas anchas muestren el contenido.
     */
    preferLineWrap?: boolean;
    /**
     * Solo lectura decorativa (p. ej. plantilla Excel en admin): sin elevación al hover
     * ni aspecto de botón; se renderiza como `div`.
     */
    isStaticPreview?: boolean;
};

export const DienstDayCell: React.FC<DienstDayCellProps> = ({
    statusClass,
    incompleteBorderClass,
    isPast,
    isDisabled,
    isPartial,
    lines,
    onOpen,
    adminDnd,
    preferLineWrap = false,
    isStaticPreview = false,
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

    const lineCls = preferLineWrap
        ? useIncompleteText
            ? `text-xs leading-tight ${INCOMPLETE_TEXT} min-w-0 break-words hyphens-auto`
            : "text-xs leading-tight text-slate-700 min-w-0 break-words hyphens-auto"
        : useIncompleteText
            ? `text-xs leading-tight ${INCOMPLETE_TEXT} flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis`
            : "text-xs leading-tight text-slate-700 flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis";

    const combinedLineCls = `${lineCls} font-semibold`;

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

    const suppressClickAfterDragRef = useRef(false);
    const [draggingSlot, setDraggingSlot] = useState<"driver" | "medic" | null>(
        null,
    );

    const getDraggableSourceClass = (
        slot: "driver" | "medic",
        layoutCls: string,
    ) => {
        const isActive = draggingSlot === slot;
        const layout =
            layoutCls.trim().length > 0 ? layoutCls : "inline-block max-w-full";
        return [
            layout,
            "transition-[transform,box-shadow] duration-150 ease-out",
            isActive
                ? "scale-[1.05] shadow-lg shadow-slate-900/18 ring-2 ring-sky-500/35 z-20 rounded-sm px-0.5 -mx-0.5 cursor-grabbing"
                : "cursor-grab active:cursor-grabbing",
        ].join(" ");
    };

    const scheduleSuppressClickAfterDrag = () => {
        suppressClickAfterDragRef.current = true;
        window.setTimeout(() => {
            suppressClickAfterDragRef.current = false;
        }, 150);
    };

    const handleOpen = () => {
        if (disabled) return;
        if (suppressClickAfterDragRef.current) return;
        onOpen();
    };

    const wrapDriverLine = (node: React.ReactNode) => {
        if (!adminDnd) return node;
        const dragDriver = Boolean(
            adminDnd.driverDraggable && adminDnd.onDragStartDriver,
        );
        const dropDriver = Boolean(
            adminDnd.driverDropTarget && adminDnd.onDropDriver,
        );
        if (dragDriver && dropDriver) {
            return (
                <span
                    data-dienst-admin-slot="driver"
                    draggable
                    className={getDraggableSourceClass(
                        "driver",
                        "block w-full min-h-[1.25em]",
                    )}
                    onDragStart={(e) => {
                        adminDnd.onDragStartDriver?.(e);
                        setDraggingSlot("driver");
                    }}
                    onDragEnd={() => {
                        scheduleSuppressClickAfterDrag();
                        adminDnd.onDragEnd?.();
                        setDraggingSlot(null);
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        adminDnd.onDragOverDriver?.(e);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        adminDnd.onDropDriver?.(e);
                    }}
                >
                    {node}
                </span>
            );
        }
        if (dragDriver) {
            return (
                <span
                    draggable
                    className={getDraggableSourceClass("driver", "")}
                    onDragStart={(e) => {
                        adminDnd.onDragStartDriver?.(e);
                        setDraggingSlot("driver");
                    }}
                    onDragEnd={() => {
                        scheduleSuppressClickAfterDrag();
                        adminDnd.onDragEnd?.();
                        setDraggingSlot(null);
                    }}
                >
                    {node}
                </span>
            );
        }
        if (adminDnd.driverDropTarget) {
            return (
                <span
                    data-dienst-admin-slot="driver"
                    className="block w-full min-h-[1.25em]"
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        adminDnd.onDragOverDriver?.(e);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        adminDnd.onDropDriver?.(e);
                    }}
                >
                    {node}
                </span>
            );
        }
        return node;
    };

    const wrapMedicLine = (node: React.ReactNode) => {
        if (!adminDnd) return node;
        const dragMedic = Boolean(
            adminDnd.medicDraggable && adminDnd.onDragStartMedic,
        );
        const dropMedic = Boolean(
            adminDnd.medicDropTarget && adminDnd.onDropMedic,
        );
        if (dragMedic && dropMedic) {
            return (
                <span
                    data-dienst-admin-slot="medic"
                    draggable
                    className={getDraggableSourceClass(
                        "medic",
                        "block w-full min-h-[1.25em]",
                    )}
                    onDragStart={(e) => {
                        adminDnd.onDragStartMedic?.(e);
                        setDraggingSlot("medic");
                    }}
                    onDragEnd={() => {
                        scheduleSuppressClickAfterDrag();
                        adminDnd.onDragEnd?.();
                        setDraggingSlot(null);
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        adminDnd.onDragOverMedic?.(e);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        adminDnd.onDropMedic?.(e);
                    }}
                >
                    {node}
                </span>
            );
        }
        if (dragMedic) {
            return (
                <span
                    draggable
                    className={getDraggableSourceClass("medic", "")}
                    onDragStart={(e) => {
                        adminDnd.onDragStartMedic?.(e);
                        setDraggingSlot("medic");
                    }}
                    onDragEnd={() => {
                        scheduleSuppressClickAfterDrag();
                        adminDnd.onDragEnd?.();
                        setDraggingSlot(null);
                    }}
                >
                    {node}
                </span>
            );
        }
        if (adminDnd.medicDropTarget) {
            return (
                <span
                    data-dienst-admin-slot="medic"
                    className="block w-full min-h-[1.25em]"
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        adminDnd.onDragOverMedic?.(e);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        adminDnd.onDropMedic?.(e);
                    }}
                >
                    {node}
                </span>
            );
        }
        return node;
    };

    const inner = (
        <>
            {/* 📅 Fecha — siempre arriba */}
            {lines?.dateLine && (
                <div
                    className={`text-xs font-semibold text-center mb-1 ${useIncompleteText ? INCOMPLETE_TEXT : "text-slate-800"
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
                <div className="space-y-0">
                    {lines?.timeLine && lines?.ambulanceLine ? (
                        preferLineWrap ? (
                            <div className="space-y-0.5">
                                <p className={`${combinedLineCls} block`}>
                                    {lines.timeLine}
                                </p>
                                <p className={`${combinedLineCls} block`}>
                                    {lines.ambulanceLine}
                                </p>
                            </div>
                        ) : (
                        /* Wide: icons + split corners | Narrow: no icons + split corners */
                        <div className={`${combinedLineCls} justify-between`}>
                            <span className="truncate min-w-0">
                                <span className="hidden xl:inline">{"🕒 "}</span>
                                {String(lines.timeLine).replace(/^🕒\s*/, "")}
                            </span>
                            <span className="shrink-0 pl-1">
                                <span className="hidden xl:inline">{"🚑 "}</span>
                                {String(lines.ambulanceLine).replace(/^🚑\s*/, "")}
                            </span>
                        </div>
                        )
                    ) : (
                        <>
                            {lines?.timeLine && <p className={lineCls}>{lines.timeLine}</p>}
                            {lines?.ambulanceLine && <p className={lineCls}>{lines.ambulanceLine}</p>}
                        </>
                    )}
                    {lines?.driverLine && (
                        <p
                            className={`${lineCls} mt-2${
                                draggingSlot === "driver"
                                    ? " overflow-visible relative z-30"
                                    : ""
                            }`}
                        >
                            {wrapDriverLine(lines.driverLine)}
                        </p>
                    )}
                    {lines?.medicLine && (
                        <p
                            className={`${lineCls}${
                                draggingSlot === "medic"
                                    ? " overflow-visible relative z-30"
                                    : ""
                            }`}
                        >
                            {wrapMedicLine(lines.medicLine)}
                        </p>
                    )}
                </div>
            )}
        </>
    );

    const shellClassName = `
        rounded-xl p-2 ring-1 text-left
        flex flex-col ${preferLineWrap ? "min-h-0" : "min-h-[72px]"}
        ${statusClass}
        ${finalBorderClass}
        ${
            disabled
                ? disabledStyle
                : isStaticPreview
                  ? "cursor-default"
                  : "transition hover:shadow-sm hover:-translate-y-0.5"
        }
      `;

    const cellDrop =
        Boolean(adminDnd?.cellDropTarget && adminDnd?.onDropCell);

    if (isStaticPreview && !adminDnd) {
        return <div className={shellClassName}>{inner}</div>;
    }

    if (adminDnd) {
        return (
            <div
                role="button"
                tabIndex={-1}
                aria-disabled={disabled}
                className={shellClassName}
                onClick={handleOpen}
                onDragOverCapture={
                    cellDrop
                        ? (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            adminDnd.onDragOverCell?.(e);
                        }
                        : undefined
                }
                onDrop={
                    cellDrop
                        ? (e) => {
                            const t = e.target as HTMLElement | null;
                            if (t?.closest?.("[data-dienst-admin-slot]")) {
                                return;
                            }
                            e.preventDefault();
                            adminDnd.onDropCell?.(e);
                        }
                        : undefined
                }
            >
                {inner}
            </div>
        );
    }

    return (
        <button
            type="button"
            disabled={disabled}
            aria-disabled={disabled}
            onClick={handleOpen}
            className={shellClassName}
        >
            {inner}
        </button>
    );
};
