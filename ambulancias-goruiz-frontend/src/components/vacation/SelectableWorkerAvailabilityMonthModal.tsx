import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    getVacationAvailability,
    type VacationAvailabilityResponse,
} from "../../api/vacation";
import { monthLabel as fmtMonth } from "../../utils/intl";
import { useVacationAvailabilityInvalidation } from "../../hooks/vacation/useVacationAvailabilityInvalidation";
import { isPastLocalDay } from "../../utils/vacation/isPastLocalDay";
import type { IVacationRequest } from "../../types/vacationRequest";
import WorkerMonthRequests from "./WorkerMonthRequests";

type DayState = "green" | "yellow" | "red";
type AcceptedRange = { startISO: string; endISO: string };

type Props = {
    isOpen: boolean;
    monthIndex: number | null;
    year: number;
    onClose: () => void;
    acceptedRanges?: AcceptedRange[];
    pendingRanges?: AcceptedRange[];
    onRequestRange: (p: { startISO: string; endISO: string; days: number }) => void;
    blockRedDays?: boolean;

    // ✅ Navegación de mes desde el modal (flechas)
    onNavigateMonth?: (next: { year: number; monthIndex: number }) => void;

    /** ✅ M-1: solo cableado (aún no se usa dentro del modal) */
    monthRequests?: IVacationRequest[];
    onCancelRequest?: (id: string) => void;
    onRespondAlternative?: (id: string, accept: boolean) => void;
};

const SelectableWorkerAvailabilityMonthModal: React.FC<Props> = ({
    isOpen,
    monthIndex,
    year,
    onClose,
    acceptedRanges = [],
    pendingRanges = [],
    onRequestRange,
    blockRedDays = true,
    onNavigateMonth,

    /** ✅ M-1: solo cableado (aún no se usa dentro del modal) */
    monthRequests = [],
    onCancelRequest,
    onRespondAlternative,
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

    // ✅ Selección por FECHA real (permite cruzar meses)
    const [rangeStartDate, setRangeStartDate] = useState<Date | null>(null);
    const [rangeEndDate, setRangeEndDate] = useState<Date | null>(null);

    // Reset de selección SOLO al abrir/cerrar (para permitir navegar meses sin perder start)
    useEffect(() => {
        if (!isOpen) return;
        setRangeStartDate(null);
        setRangeEndDate(null);
    }, [isOpen]);

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

    const pendingDaysSet = useMemo(() => {
        if (monthIndex === null || pendingRanges.length === 0) return new Set<number>();

        const days = new Set<number>();
        for (const r of pendingRanges) {
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
    }, [pendingRanges, monthIndex, year]);

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

    // Invalidación
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
        const state = rec ? rec.state : "green";
        // Worker NO ve amarillo global (solo rojo bloquea)
        return state === "red" ? "red" : "green";
    };

    const isInSelectedRange = (day: number) => {
        if (monthIndex === null || !rangeStartDate) return false;

        const cellDate = new Date(year, monthIndex, day, 0, 0, 0, 0);

        const end = rangeEndDate ?? rangeStartDate;
        const a = rangeStartDate < end ? rangeStartDate : end;
        const b = rangeStartDate < end ? end : rangeStartDate;

        return cellDate >= a && cellDate <= b;
    };

    const selectedSummary = useMemo(() => {
        if (!rangeStartDate) return null;

        const end = rangeEndDate ?? rangeStartDate;
        const a = rangeStartDate < end ? rangeStartDate : end;
        const b = rangeStartDate < end ? end : rangeStartDate;

        // días inclusive (robusto cruzando meses)
        const msPerDay = 24 * 60 * 60 * 1000;
        const startUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const endUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        const days = Math.floor((endUTC - startUTC) / msPerDay) + 1;

        return {
            a: a.getDate(),
            b: b.getDate(),
            days,
            startISO: a.toISOString(),
            endISO: b.toISOString(),
        };
    }, [rangeStartDate, rangeEndDate]);

    const selectionHasRed = useMemo(() => {
        // Igual que antes: validamos rojo por días del mes visible (lo mínimo para no romper)
        if (!availability || !selectedSummary) return false;
        const { a, b } = selectedSummary;
        for (let d = a; d <= b; d++) {
            const st = getDayState(d);
            if (st === "red") return true;
        }
        return false;
    }, [availability, selectedSummary]);

    const isBlockedDay = (day: number) => {
        if (monthIndex === null) return true;

        // pasado
        if (isPastLocalDay(new Date(year, monthIndex, day, 0, 0, 0, 0))) return true;

        // ya es mío
        if (acceptedDaysSet.has(day) || pendingDaysSet.has(day)) return true;

        // rojo
        const st = getDayState(day);
        if (blockRedDays && st === "red") return true;

        return false;
    };

    const rangeHasBlockedDays = (a: number, b: number) => {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        for (let d = start; d <= end; d++) {
            if (isBlockedDay(d)) return true;
        }
        return false;
    };

    const handleDayClick = (day: number) => {
        if (!availability || monthIndex === null) return;
        if (isBlockedDay(day)) return;

        const clickedDate = new Date(year, monthIndex, day, 0, 0, 0, 0);

        // 1) Primer click: start
        if (!rangeStartDate) {
            setRangeStartDate(clickedDate);
            setRangeEndDate(null);
            return;
        }

        // 2) Si ya hay start y NO hay end aún:
        if (!rangeEndDate) {
            // ✅ Solo hacia delante:
            // Si el usuario clickea un día ANTERIOR al start => reiniciamos start en ese día
            if (clickedDate < rangeStartDate) {
                setRangeStartDate(clickedDate);
                setRangeEndDate(null);
                return;
            }

            // ✅ Si haces click otra vez en el MISMO día (start) => deseleccionar
            if (clickedDate.getTime() === rangeStartDate.getTime()) {
                setRangeStartDate(null);
                setRangeEndDate(null);
                return;
            }


            // Si es posterior => intentamos fijar end
            // (Validación mínima dentro del mes visible: se mantiene tu lógica actual)
            if (rangeHasBlockedDays(rangeStartDate.getDate(), day)) {
                // si el rango dentro del mes visible pasa por bloqueados, reiniciamos start
                setRangeStartDate(clickedDate);
                setRangeEndDate(null);
                return;
            }

            setRangeEndDate(clickedDate);
            return;
        }

        // 3) Si ya hay ambos (start y end): reinicia con nuevo start
        setRangeStartDate(clickedDate);
        setRangeEndDate(null);
    };


    const selectionHasPast = useMemo(() => {
        if (!selectedSummary || monthIndex === null) return false;
        const { a, b } = selectedSummary;
        for (let d = a; d <= b; d++) {
            if (isPastLocalDay(new Date(year, monthIndex, d, 0, 0, 0, 0))) return true;
        }
        return false;
    }, [selectedSummary, monthIndex, year]);

    const canRequest =
        !!selectedSummary &&
        !!onRequestRange &&
        !availLoading &&
        !availError &&
        !(blockRedDays && selectionHasRed) &&
        !selectionHasPast;

    // ✅ Flechas: visibles solo tras elegir start y antes de elegir end
    const showNavArrows = !!rangeStartDate && !rangeEndDate;

    const goNextMonth = () => {
        if (monthIndex === null) return;
        const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
        const nextYear = monthIndex === 11 ? year + 1 : year;
        onNavigateMonth?.({ year: nextYear, monthIndex: nextMonthIndex });
    };

    if (!isOpen || monthIndex === null) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />

            <div
                className="relative z-10 w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]"
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
                        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-emerald-300" />
                                {String(
                                    t("pages.vacations.monthGrid.legend.available", {
                                        defaultValue: "Disponible",
                                    }),
                                )}
                            </span>

                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-amber-300" />
                                {String(
                                    t("pages.vacations.monthGrid.legend.myPending", {
                                        defaultValue: "Mis pendientes",
                                    }),
                                )}
                            </span>

                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-orange-400" />
                                {String(
                                    t("pages.vacations.monthGrid.legend.myAccepted", {
                                        defaultValue: "Aceptadas",
                                    }),
                                )}
                            </span>

                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-rose-300" />
                                {String(
                                    t("pages.vacations.monthGrid.legend.full", {
                                        defaultValue: "Sin disponibilidad",
                                    }),
                                )}
                            </span>

                            {availability && (
                                <span className="ml-auto text-slate-500">
                                    {String(
                                        t("pages.vacations.adminPage.capacity", {
                                            count: availability.maxPerDay,
                                            defaultValue: `Capacidad: ${availability.maxPerDay}`,
                                        }),
                                    )}
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
                        <div className="grid grid-cols-7 gap-0">
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
                                    const isPendingMine = pendingDaysSet.has(cell);
                                    const isBlocked = isBlockedDay(cell);

                                    const baseColor =
                                        state === "red"
                                            ? "bg-rose-50 text-slate-800 border-2 border-rose-300"
                                            : "bg-emerald-50 text-slate-800 border-2 border-emerald-300";

                                    const acceptedCls = isAccepted
                                        ? "!bg-orange-200 !border-orange-400 !text-slate-900 font-semibold"
                                        : "";

                                    const pendingFillCls =
                                        !isAccepted && isPendingMine
                                            ? "!bg-amber-100 !border-amber-300 !text-slate-900 font-semibold"
                                            : "";

                                    // selección visual conectada (dentro del mes visible)
                                    const startDayInThisMonth =
                                        !!rangeStartDate &&
                                            rangeStartDate.getFullYear() === year &&
                                            rangeStartDate.getMonth() === monthIndex
                                            ? rangeStartDate.getDate()
                                            : null;

                                    const endDayInThisMonth =
                                        !!rangeEndDate &&
                                            rangeEndDate.getFullYear() === year &&
                                            rangeEndDate.getMonth() === monthIndex
                                            ? rangeEndDate.getDate()
                                            : null;

                                    const a =
                                        startDayInThisMonth !== null
                                            ? Math.min(startDayInThisMonth, endDayInThisMonth ?? startDayInThisMonth)
                                            : null;

                                    const b =
                                        startDayInThisMonth !== null
                                            ? Math.max(startDayInThisMonth, endDayInThisMonth ?? startDayInThisMonth)
                                            : null;

                                    const isRangeSingle =
                                        startDayInThisMonth !== null &&
                                        endDayInThisMonth === null &&
                                        cell === startDayInThisMonth;

                                    const isRangeStart = a !== null && cell === a;
                                    const isRangeEnd = b !== null && cell === b;

                                    const selectionFillCls =
                                        isSelected && !isAccepted && !isPendingMine
                                            ? "!bg-amber-50 !border-amber-200 !text-slate-900"
                                            : "";

                                    const selectionShapeCls =
                                        isSelected && a !== null && b !== null
                                            ? isRangeSingle
                                                ? "rounded-md"
                                                : isRangeStart
                                                    ? "rounded-l-md rounded-r-none"
                                                    : isRangeEnd
                                                        ? "rounded-r-md rounded-l-none"
                                                        : "rounded-none"
                                            : "";

                                    const blockedCls = isBlocked
                                        ? "opacity-40 cursor-not-allowed pointer-events-none"
                                        : "cursor-pointer hover:brightness-95 active:scale-[0.98]";

                                    return (
                                        <button
                                            type="button"
                                            key={`d-${cell}-${idx}`}
                                            disabled={isBlocked}
                                            onClick={() => handleDayClick(cell)}
                                            className={[
                                                "h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none transition",
                                                baseColor,
                                                acceptedCls,
                                                pendingFillCls,
                                                selectionFillCls,
                                                selectionShapeCls,
                                                blockedCls,
                                                !isBlocked ? "focus:outline-none focus:ring-2 focus:ring-blue-200" : "",
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
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs text-slate-700">
                                            {String(
                                                t("pages.vacations.workerPage.selectedRange", {
                                                    defaultValue: `Del ${selectedSummary.a} al ${selectedSummary.b} (${selectedSummary.days} días)`,
                                                }),
                                            )}
                                        </p>

                                        {showNavArrows && (
                                            <button
                                                type="button"
                                                onClick={goNextMonth}
                                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-200 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                                aria-label={t("common.nextMonth", "Mes siguiente")}
                                                title={t("common.nextMonth", "Mes siguiente")}
                                            >
                                                →
                                            </button>
                                        )}
                                    </div>

                                    {blockRedDays && selectionHasRed && (
                                        <p className="mt-1 text-[11px] text-rose-700">
                                            {t(
                                                "pages.vacations.requestForm.rangeBlocked",
                                                "El rango contiene días sin disponibilidad.",
                                            )}
                                        </p>
                                    )}

                                    {selectionHasPast && (
                                        <p className="mt-1 text-[11px] text-rose-700">
                                            {String(
                                                t("pages.vacations.workerPage.pastDaysBlocked", {
                                                    defaultValue: "No puedes solicitar vacaciones en días pasados.",
                                                }),
                                            )}
                                        </p>
                                    )}

                                    <div className="mt-2 flex justify-end">
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
                                            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                                        >
                                            {String(
                                                t("pages.vacations.workerPage.requestFromGrid", {
                                                    defaultValue: "Solicitar",
                                                }),
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-slate-600">
                                        {String(
                                            t("pages.vacations.workerPage.clickToSelect", {
                                                defaultValue: "Haz clic en un día para empezar a seleccionar.",
                                            }),
                                        )}
                                    </p>

                                    {showNavArrows && (
                                        <button
                                            type="button"
                                            onClick={goNextMonth}
                                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-200 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                            aria-label={t("common.nextMonth", "Mes siguiente")}
                                            title={t("common.nextMonth", "Mes siguiente")}
                                        >
                                            →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <WorkerMonthRequests
                    requests={monthRequests}
                    monthIndex={monthIndex}
                    year={year}
                    onCancelRequest={onCancelRequest}
                    onRespondAlternative={onRespondAlternative}
                />

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
