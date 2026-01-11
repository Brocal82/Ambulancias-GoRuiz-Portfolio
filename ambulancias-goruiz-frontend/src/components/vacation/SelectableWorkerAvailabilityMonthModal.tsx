import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    getVacationAvailability,
    type VacationAvailabilityResponse,
} from "../../api/vacation";
import { monthLabel as fmtMonth } from "../../utils/intl";
import { useVacationAvailabilityInvalidation } from "../../hooks/vacation/useVacationAvailabilityInvalidation";

type DayState = "green" | "yellow" | "red";
type AcceptedRange = { startISO: string; endISO: string };

type Props = {
    isOpen: boolean;
    monthIndex: number | null; // 0..11
    year: number;
    onClose: () => void;

    /** rangos aceptados del propio worker (solo visual) */
    acceptedRanges?: AcceptedRange[];

    /**
     * ✅ NUEVO (Paso 2): callback para solicitar vacaciones desde selección
     * - startISO/endISO son ISO completos (Date.toISOString())
     */
    onRequestRange?: (p: { startISO: string; endISO: string; days: number }) => void;

    /** Si quieres permitir/mostrar selección solo en verdes+amarillos */
    blockRedDays?: boolean; // default true
};

const SelectableWorkerAvailabilityMonthModal: React.FC<Props> = ({
    isOpen,
    monthIndex,
    year,
    onClose,
    acceptedRanges = [],
    onRequestRange,
    blockRedDays = true,
}) => {
    const { t, i18n } = useTranslation();

    const locale =
        i18n.language === "de"
            ? "de-DE"
            : i18n.language === "en"
                ? "en-US"
                : "es-ES";

    const [availability, setAvailability] =
        useState<VacationAvailabilityResponse | null>(null);
    const [availLoading, setAvailLoading] = useState(false);
    const [availError, setAvailError] = useState<string | null>(null);

    // Control de carreras
    const inFlightKeyRef = useRef<string | null>(null);
    const refreshTimerRef = useRef<number | null>(null);

    // ✅ NUEVO: selección de rango dentro del mes
    const [rangeStartDay, setRangeStartDay] = useState<number | null>(null);
    const [rangeEndDay, setRangeEndDay] = useState<number | null>(null);

    // Reset de selección cuando se abre/cambia mes/año
    useEffect(() => {
        if (!isOpen) return;
        setRangeStartDay(null);
        setRangeEndDay(null);
    }, [isOpen, monthIndex, year]);

    // Cabeceras LUN-DOM
    const weekdayHeaders = useMemo(() => {
        const baseMonday = new Date(Date.UTC(2023, 0, 2));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(baseMonday);
            d.setUTCDate(baseMonday.getUTCDate() + i);
            return d.toLocaleDateString(locale, { weekday: "short" });
        });
    }, [locale]);

    // Celdas (42)
    const calendarCells = useMemo(() => {
        if (monthIndex === null) return Array(42).fill(null);
        const first = new Date(year, monthIndex, 1);
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const jsFirstDow = first.getDay(); // 0-dom..6-sáb
        const mondayBased = (jsFirstDow + 6) % 7; // 0-lun
        const leading = Array.from({ length: mondayBased }, () => null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const base = [...leading, ...days];
        return base.concat(
            Array.from({ length: Math.max(0, 42 - base.length) }, () => null),
        );
    }, [monthIndex, year]);

    const acceptedDaysSet = useMemo(() => {
        if (monthIndex === null || acceptedRanges.length === 0) return new Set<number>();

        const days = new Set<number>();
        for (const r of acceptedRanges) {
            const start = new Date(r.startISO);
            const end = new Date(r.endISO);

            const monthStart = new Date(year, monthIndex, 1);
            const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

            if (end < monthStart || start > monthEnd) continue;

            const s = start < monthStart ? monthStart : start;
            const e = end > monthEnd ? monthEnd : end;

            for (let d = s.getDate(); d <= e.getDate(); d++) days.add(d);
        }
        return days;
    }, [acceptedRanges, monthIndex, year]);

    const loadAvailability = async (y: number, m1: number, force = false) => {
        const key = `${y}-${String(m1).padStart(2, "0")}`;
        inFlightKeyRef.current = key;
        try {
            setAvailLoading(true);
            setAvailError(null);
            const data = await getVacationAvailability({ year: y, month: m1 }, { force });
            if (inFlightKeyRef.current !== key) return;
            setAvailability(data);
        } catch {
            if (inFlightKeyRef.current !== key) return;
            setAvailError("load_error");
        } finally {
            if (inFlightKeyRef.current === key) setAvailLoading(false);
        }
    };

    // Primer fetch al abrir/cambiar mes
    useEffect(() => {
        if (!isOpen || monthIndex === null) return;
        const m1 = monthIndex + 1;
        loadAvailability(year, m1, false);
        return () => {
            if (refreshTimerRef.current) {
                window.clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, monthIndex, year]);

    // Invalidación (misma lógica que el modal actual)
    useVacationAvailabilityInvalidation(({ year: y, month: m1 }) => {
        if (!isOpen || monthIndex === null) return;

        const myMonth = monthIndex + 1;
        if (y !== year || m1 !== myMonth) return;

        if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = window.setTimeout(() => {
            loadAvailability(year, myMonth, true);
        }, 200);
    });

    const getDayState = (day: number | null): DayState | null => {
        if (!availability || day === null) return null;
        const rec = availability.days.find((d) => d.day === day);
        return rec ? rec.state : "green";
    };

    const isInSelectedRange = (day: number) => {
        if (rangeStartDay === null) return false;
        if (rangeEndDay === null) return day === rangeStartDay;

        const a = Math.min(rangeStartDay, rangeEndDay);
        const b = Math.max(rangeStartDay, rangeEndDay);
        return day >= a && day <= b;
    };

    const selectedSummary = useMemo(() => {
        if (monthIndex === null || rangeStartDay === null) return null;

        const startDay = rangeStartDay;
        const endDay = rangeEndDay ?? rangeStartDay;

        const a = Math.min(startDay, endDay);
        const b = Math.max(startDay, endDay);

        const days = b - a + 1;

        const startDate = new Date(year, monthIndex, a, 0, 0, 0, 0);
        const endDate = new Date(year, monthIndex, b, 0, 0, 0, 0);

        return {
            a,
            b,
            days,
            startISO: startDate.toISOString(),
            endISO: endDate.toISOString(),
        };
    }, [rangeStartDay, rangeEndDay, monthIndex, year]);

    const selectionHasRed = useMemo(() => {
        if (!availability || !selectedSummary) return false;
        const { a, b } = selectedSummary;

        for (let d = a; d <= b; d++) {
            const state = getDayState(d);
            if (state === "red") return true;
        }
        return false;
    }, [availability, selectedSummary]);

    const handleDayClick = (day: number) => {
        if (!availability || monthIndex === null) return;

        const state = getDayState(day);

        // Bloquear click en rojo (primera versión)
        if (blockRedDays && state === "red") return;

        // 1er click: fija start
        if (rangeStartDay === null) {
            setRangeStartDay(day);
            setRangeEndDay(null);
            return;
        }

        // 2º click: fija end (permite invertir)
        if (rangeEndDay === null) {
            setRangeEndDay(day);
            return;
        }

        // Si ya hay ambos: reinicia con nuevo start
        setRangeStartDay(day);
        setRangeEndDay(null);
    };

    const canRequest =
        !!selectedSummary &&
        !!onRequestRange &&
        !availLoading &&
        !availError &&
        !(blockRedDays && selectionHasRed);

    if (!isOpen || monthIndex === null) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />

            <div
                className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="worker-availability-month-title"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                        <h3
                            id="worker-availability-month-title"
                            className="text-base font-semibold text-slate-900 truncate"
                        >
                            {`${fmtMonth(year, monthIndex)} · ${year}`}
                        </h3>

                        <button
                            aria-label={t("pages.vacations.monthModal.close")}
                            onClick={onClose}
                            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="rounded-xl ring-1 ring-slate-200 bg-white p-2">
                        {/* Leyenda */}
                        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-emerald-300" />
                                {t("pages.vacations.monthGrid.legend.available")}
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-amber-300" />
                                {t("pages.vacations.monthGrid.legend.requested")}
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-rose-300" />
                                {t("pages.vacations.monthGrid.legend.full")}
                            </span>

                            {availability && (
                                <span className="ml-auto text-slate-500">
                                    {t("pages.vacations.adminPage.capacity", {
                                        count: availability.maxPerDay,
                                    })}
                                </span>
                            )}
                        </div>

                        {/* Week headers */}
                        <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                            {weekdayHeaders.map((w, i) => (
                                <div key={i} className="py-0.5">
                                    {w}
                                </div>
                            ))}
                        </div>

                        {/* Calendar */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {availLoading &&
                                Array.from({ length: 42 }).map((_, i) => (
                                    <div
                                        key={`sk-${i}`}
                                        className="h-6 sm:h-7 md:h-8 rounded bg-slate-100 animate-pulse"
                                    />
                                ))}

                            {!availLoading &&
                                calendarCells.map((cell, idx) => {
                                    if (cell === null) {
                                        return (
                                            <div
                                                key={`empty-${idx}`}
                                                className="h-6 sm:h-7 md:h-8 rounded bg-transparent"
                                            />
                                        );
                                    }

                                    const state = getDayState(cell);
                                    const isAccepted = acceptedDaysSet.has(cell);
                                    const isSelected = isInSelectedRange(cell);

                                    const baseColor =
                                        state === "red"
                                            ? "bg-rose-50 text-slate-800 border-2 border-rose-300"
                                            : state === "yellow"
                                                ? "bg-amber-50 text-slate-800 border-2 border-amber-300"
                                                : "bg-emerald-50 text-slate-800 border-2 border-emerald-300";

                                    const acceptedCls = isAccepted
                                        ? "!bg-sky-200 !border-sky-300 !text-slate-900 font-semibold"
                                        : "";

                                    const selectedCls = isSelected
                                        ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-white"
                                        : "";

                                    const blockedCls =
                                        blockRedDays && state === "red"
                                            ? "opacity-60 cursor-not-allowed"
                                            : "cursor-pointer hover:brightness-95 active:scale-[0.98]";

                                    return (
                                        <button
                                            type="button"
                                            key={`d-${cell}-${idx}`}
                                            onClick={() => handleDayClick(cell)}
                                            className={[
                                                "h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none transition",
                                                baseColor,
                                                acceptedCls,
                                                selectedCls,
                                                blockedCls,
                                                "focus:outline-none focus:ring-2 focus:ring-blue-200",
                                            ].join(" ")}
                                            title={`${cell}`}
                                            aria-label={`${cell}`}
                                        >
                                            {cell}
                                        </button>
                                    );
                                })}
                        </div>

                        {availError && (
                            <p className="mt-2 text-[11px] text-rose-600">
                                {t("common.loadError", "No se pudo cargar la disponibilidad.")}
                            </p>
                        )}

                        {/* ✅ Resumen + botón solicitar */}
                        <div className="mt-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-2">
                            {selectedSummary ? (
                                <>
                                    <p className="text-xs text-slate-700">
                                        {String(
                                            t("pages.vacations.workerPage.selectedRange", {
                                                defaultValue: `Del ${selectedSummary.a} al ${selectedSummary.b} (${selectedSummary.days} días)`,
                                            }),
                                        )}
                                    </p>


                                    {blockRedDays && selectionHasRed && (
                                        <p className="mt-1 text-[11px] text-rose-700">
                                            {t(
                                                "pages.vacations.requestForm.rangeBlocked",
                                                "El rango contiene días sin disponibilidad.",
                                            )}
                                        </p>
                                    )}

                                    <button
                                        type="button"
                                        disabled={!canRequest}
                                        onClick={() => {
                                            if (!selectedSummary) return;
                                            onRequestRange?.({
                                                startISO: selectedSummary.startISO,
                                                endISO: selectedSummary.endISO,
                                                days: selectedSummary.days,
                                            });
                                        }}
                                        className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                                    >
                                        {String(
                                            t("pages.vacations.workerPage.requestFromGrid", {
                                                defaultValue: "Solicitar",
                                            }),
                                        )}

                                    </button>
                                </>
                            ) : (
                                <p className="text-xs text-slate-600">
                                    {String(
                                        t("pages.vacations.workerPage.clickToSelect", {
                                            defaultValue: "Haz clic en un día para empezar a seleccionar.",
                                        }),
                                    )}

                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                        {t("pages.vacations.monthModal.close")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectableWorkerAvailabilityMonthModal;
