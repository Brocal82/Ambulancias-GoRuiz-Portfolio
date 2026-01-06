import React from "react";
import {
    DAY_LABELS,
    ORDERED_DAY_INDICES,
    type DayScheduleFormRow,
} from "../../utils/dienstTemplates/templateSchedule";

type Variant = "create" | "edit";

interface Props {
    variant: Variant;

    // Nº Dienst + active
    dienstNumber: number | "";
    onDienstNumberChange: (value: number | "") => void;

    isActive: boolean;
    onIsActiveChange: (value: boolean) => void;

    // Schedule rows
    rows: DayScheduleFormRow[];

    onToggleDayOff: (dayIndex: number, isOff: boolean) => void;
    onChangeDayStartTime: (dayIndex: number, value: string) => void;
    onChangeDayEndTime: (dayIndex: number, value: string) => void;

    // Para mantener IDs EXACTOS (create vs edit)
    dienstNumberInputId: string; // "createDienstNumber" | "editDienstNumber"
    isActiveCheckboxId: string; // "createIsActive" | "editIsActive"
}

const DienstTemplateScheduleGrid: React.FC<Props> = ({
    variant,
    dienstNumber,
    onDienstNumberChange,
    isActive,
    onIsActiveChange,
    rows,
    onToggleDayOff,
    onChangeDayStartTime,
    onChangeDayEndTime,
    dienstNumberInputId,
    isActiveCheckboxId,
}) => {
    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-600">
                    {variant === "create"
                        ? "Configura el número de Dienst y el horario por día. Los días libres se muestran en verde con la palmera 🌴."
                        : "Ajusta el número de Dienst y el horario por día. Los días libres se muestran en verde con la palmera 🌴."}
                </p>
                <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 sm:inline">
                    Semana de lunes a domingo
                </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                {/* Columna: Nº Dienst */}
                <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-gray-800">
                            Nº Dienst
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <label htmlFor={dienstNumberInputId} className="sr-only">
                                Número de Dienst
                            </label>
                            <input
                                id={dienstNumberInputId}
                                type="number"
                                min={1}
                                value={dienstNumber}
                                onChange={(e) =>
                                    onDienstNumberChange(
                                        e.target.value === "" ? "" : Number(e.target.value),
                                    )
                                }
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                            <input
                                id={isActiveCheckboxId}
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => onIsActiveChange(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                                htmlFor={isActiveCheckboxId}
                                className="text-[11px] font-medium text-gray-700"
                            >
                                Plantilla activa
                            </label>
                        </div>
                    </div>
                </div>

                {/* Columnas: Lunes → Domingo */}
                {ORDERED_DAY_INDICES.map((index) => {
                    const day = rows.find((d) => d.dayIndex === index);
                    if (!day) return null;

                    const isOff = day.isOff;

                    const startInputId =
                        variant === "create"
                            ? `startTime-${day.dayIndex}`
                            : `edit-startTime-${day.dayIndex}`;

                    const endInputId =
                        variant === "create"
                            ? `endTime-${day.dayIndex}`
                            : `edit-endTime-${day.dayIndex}`;

                    return (
                        <div
                            key={day.dayIndex}
                            className={`flex h-full flex-col rounded-xl border p-2 text-xs shadow-sm transition-colors ${isOff
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-gray-200 bg-white"
                                }`}
                        >
                            {/* Cabecera día + toggle */}
                            <div className="mb-2 flex items-center justify-between gap-1">
                                <span className="text-[11px] font-semibold text-gray-800">
                                    {DAY_LABELS[day.dayIndex]}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onToggleDayOff(day.dayIndex, !isOff)}
                                    className="rounded-full p-1 text-[13px] hover:bg-black/5"
                                    aria-label={
                                        isOff
                                            ? `Editar día ${DAY_LABELS[day.dayIndex]}`
                                            : `Marcar ${DAY_LABELS[day.dayIndex]} como libre`
                                    }
                                >
                                    {isOff ? "⚙️" : "🌴"}
                                </button>
                            </div>

                            {/* Contenido */}
                            {isOff ? (
                                <div className="flex flex-1 items-center justify-center text-[11px] font-medium text-emerald-800">
                                    <span className="flex items-center gap-1">🌴 Libre</span>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div>
                                        <label htmlFor={startInputId} className="sr-only">
                                            {variant === "create"
                                                ? `Hora de inicio (${DAY_LABELS[day.dayIndex]})`
                                                : `Hora de inicio (${DAY_LABELS[day.dayIndex]})`}
                                        </label>
                                        <input
                                            id={startInputId}
                                            type="time"
                                            value={day.startTime}
                                            onChange={(e) =>
                                                onChangeDayStartTime(day.dayIndex, e.target.value)
                                            }
                                            className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor={endInputId} className="sr-only">
                                            {variant === "create"
                                                ? `Hora de fin (${DAY_LABELS[day.dayIndex]})`
                                                : `Hora de fin ({DAY_LABELS[day.dayIndex]})`}
                                        </label>
                                        <input
                                            id={endInputId}
                                            type="time"
                                            value={day.endTime}
                                            onChange={(e) =>
                                                onChangeDayEndTime(day.dayIndex, e.target.value)
                                            }
                                            className="w-full rounded-md border border-gray-300 px-1 py-0.5 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DienstTemplateScheduleGrid;
