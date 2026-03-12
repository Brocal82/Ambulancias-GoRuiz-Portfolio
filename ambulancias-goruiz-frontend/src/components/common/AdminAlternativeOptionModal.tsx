// frontend/src/components/vacation/AdminAlternativeOptionModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    getVacationAvailability,
    type VacationAvailabilityResponse,
} from "../../modules/vacation/domain/api";
import { monthLabel as fmtMonth } from "../../utils/intl";
import { useVacationAvailabilityInvalidation } from "../../modules/vacation/hooks/useVacationAvailabilityInvalidation";
import { isPastLocalDay } from "../../modules/vacation/utils/isPastLocalDay";

type DayState = "green" | "red";

type Props = {
    isOpen: boolean;
    monthIndex: number | null; // 0..11
    year: number;

    onClose: () => void;

    /** Navegación mes (flechas) */
    onNavigateMonth?: (next: { year: number; monthIndex: number }) => void;

    /** Submit final (rango + nota) */
    onSubmit: (p: { startISO: string; endISO: string; adminNote: string; days: number }) => void;

    /** Bloquear días rojos */
    blockRedDays?: boolean;

    /** Inicial (opcional) para abrir ya con un rango */
    initialStartDate?: Date;
    initialEndDate?: Date;
};

const AdminAlternativeOptionModal: React.FC<Props> = ({
    isOpen,
    monthIndex,
    year,
    onClose,
    onNavigateMonth,
    onSubmit,
    blockRedDays = true,
    initialStartDate,
    initialEndDate,
}) => {
    const { t, i18n } = useTranslation();

    const locale =
        i18n.language === "de" ? "de-DE" : i18n.language === "en" ? "en-US" : "es-ES";

    const formatShortDate = (d: Date) => {
        return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
    };

    const [availability, setAvailability] = useState<VacationAvailabilityResponse | null>(null);
    const [availLoading, setAvailLoading] = useState(false);
    const [availError, setAvailError] = useState<string | null>(null);

    const inFlightKeyRef = useRef<string | null>(null);
    const refreshTimerRef = useRef<number | null>(null);

    // ✅ Selección por FECHA real (permite cruzar meses)
    const [rangeStartDate, setRangeStartDate] = useState<Date | null>(null);
    const [rangeEndDate, setRangeEndDate] = useState<Date | null>(null);

    const [adminNote, setAdminNote] = useState("");

    // Reset al abrir/cerrar
    useEffect(() => {
        if (!isOpen) return;

        // si vienen iniciales, precargamos selección (mismo comportamiento “proponer alternativa desde rango original”)
        if (initialStartDate && initialEndDate) {
            setRangeStartDate(new Date(initialStartDate));
            setRangeEndDate(new Date(initialEndDate));
        } else {
            setRangeStartDate(null);
            setRangeEndDate(null);
        }

        setAdminNote("");
    }, [isOpen, initialStartDate, initialEndDate]);

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
        const jsFirstDow = first.getDay();
        const mondayBased = (jsFirstDow + 6) % 7;
        const leading = Array.from({ length: mondayBased }, () => null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const base = [...leading, ...days];
        return base.concat(Array.from({ length: Math.max(0, 42 - base.length) }, () => null));
    }, [monthIndex, year]);

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

    // Fetch al abrir/cambiar mes
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

        const msPerDay = 24 * 60 * 60 * 1000;
        const startUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const endUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        const days = Math.floor((endUTC - startUTC) / msPerDay) + 1;

        return {
            days,
            startISO: a.toISOString(),
            endISO: b.toISOString(),
            a,
            b,
        };
    }, [rangeStartDate, rangeEndDate]);

    const selectedLabel = useMemo(() => {
        if (!rangeStartDate) return null;

        const end = rangeEndDate ?? rangeStartDate;
        const a = rangeStartDate < end ? rangeStartDate : end;
        const b = rangeStartDate < end ? end : rangeStartDate;

        return `${formatShortDate(a)} – ${formatShortDate(b)}`;
    }, [rangeStartDate, rangeEndDate, locale]);

    const isBlockedDay = (day: number) => {
        if (monthIndex === null) return true;

        if (isPastLocalDay(new Date(year, monthIndex, day, 0, 0, 0, 0))) return true;

        const st = getDayState(day);
        if (blockRedDays && st === "red") return true;

        return false;
    };

    const rangeHasBlockedDaysInThisMonth = (aDay: number, bDay: number) => {
        const start = Math.min(aDay, bDay);
        const end = Math.max(aDay, bDay);
        for (let d = start; d <= end; d++) {
            if (isBlockedDay(d)) return true;
        }
        return false;
    };

    const handleDayClick = (day: number) => {
        if (!availability || monthIndex === null) return;
        if (isBlockedDay(day)) return;

        const clickedDate = new Date(year, monthIndex, day, 0, 0, 0, 0);

        if (!rangeStartDate) {
            setRangeStartDate(clickedDate);
            setRangeEndDate(null);
            return;
        }

        if (!rangeEndDate) {
            if (clickedDate < rangeStartDate) {
                setRangeStartDate(clickedDate);
                setRangeEndDate(null);
                return;
            }

            if (clickedDate.getTime() === rangeStartDate.getTime()) {
                setRangeStartDate(null);
                setRangeEndDate(null);
                return;
            }

            // validación mínima dentro del mes visible (mismo patrón que tu worker modal)
            if (rangeHasBlockedDaysInThisMonth(rangeStartDate.getDate(), day)) {
                setRangeStartDate(clickedDate);
                setRangeEndDate(null);
                return;
            }

            setRangeEndDate(clickedDate);
            return;
        }

        setRangeStartDate(clickedDate);
        setRangeEndDate(null);
    };

    const selectionHasPast = useMemo(() => {
        if (!selectedSummary || monthIndex === null) return false;

        // validación mínima dentro del mes visible (igual patrón)
        const startDay =
            selectedSummary.a.getFullYear() === year && selectedSummary.a.getMonth() === monthIndex
                ? selectedSummary.a.getDate()
                : null;

        const endDay =
            selectedSummary.b.getFullYear() === year && selectedSummary.b.getMonth() === monthIndex
                ? selectedSummary.b.getDate()
                : null;

        if (startDay === null) return false;
        const a = Math.min(startDay, endDay ?? startDay);
        const b = Math.max(startDay, endDay ?? startDay);

        for (let d = a; d <= b; d++) {
            if (isPastLocalDay(new Date(year, monthIndex, d, 0, 0, 0, 0))) return true;
        }
        return false;
    }, [selectedSummary, monthIndex, year]);

    const canSubmit =
        !!selectedSummary &&
        !availLoading &&
        !availError &&
        !selectionHasPast;

    // Flechas (mismo patrón que tu worker modal)
    const showNavArrows = !!rangeStartDate;
    const startMonthIndex = rangeStartDate?.getMonth() ?? null;
    const startYear = rangeStartDate?.getFullYear() ?? null;

    const canGoPrev =
        showNavArrows &&
        startMonthIndex !== null &&
        startYear !== null &&
        (monthIndex !== startMonthIndex || year !== startYear);

    const goPrevMonth = () => {
        if (monthIndex === null) return;
        const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
        const prevYear = monthIndex === 0 ? year - 1 : year;
        onNavigateMonth?.({ year: prevYear, monthIndex: prevMonthIndex });
    };

    const goNextMonth = () => {
        if (monthIndex === null) return;
        const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
        const nextYear = monthIndex === 11 ? year + 1 : year;
        onNavigateMonth?.({ year: nextYear, monthIndex: nextMonthIndex });
    };

    const closeBtnRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        if (!isOpen) return;
        closeBtnRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || monthIndex === null) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />

            <div
                className="relative z-10 w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-alt-month-title"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                        <h3
                            id="admin-alt-month-title"
                            className="text-base font-semibold text-slate-900 truncate"
                        >
                            {String(t("pages.vacations.altModal.title", { defaultValue: "Proponer alternativa" }))} ·{" "}
                            {`${fmtMonth(year, monthIndex)} · ${year}`}
                        </h3>

                        <button
                            ref={closeBtnRef}
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
                        {/* Leyenda (misma que worker, sin “mis pendientes/aceptadas”) */}
                        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-emerald-300" />
                                {String(
                                    t("pages.vacations.monthGrid.legend.available", { defaultValue: "Disponible" }),
                                )}
                            </span>

                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded border-2 border-rose-300" />
                                {String(
                                    t("pages.vacations.monthGrid.legend.full", { defaultValue: "Sin disponibilidad" }),
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

                        {/* Calendar (misma UI que worker) */}
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
                                    const isSelected = isInSelectedRange(cell);
                                    const isBlocked = isBlockedDay(cell);

                                    const baseColor =
                                        state === "red"
                                            ? "bg-rose-50 text-slate-800 border-2 border-rose-300"
                                            : "bg-emerald-50 text-slate-800 border-2 border-emerald-300";

                                    // selección conectada (igual patrón que worker modal)
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
                                        startDayInThisMonth !== null && endDayInThisMonth === null && cell === startDayInThisMonth;

                                    const isRangeStart = a !== null && cell === a;
                                    const isRangeEnd = b !== null && cell === b;

                                    const selectionFillCls =
                                        isSelected ? "!bg-amber-50 !border-amber-200 !text-slate-900" : "";

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

                        {/* Resumen + flechas + botón (igual patrón worker) */}
                        <div className="mt-3">
                            {selectedSummary && (
                                <div className="flex justify-center">
                                    <div className="inline-flex items-center gap-2">
                                        {showNavArrows && canGoPrev && (
                                            <button
                                                type="button"
                                                onClick={goPrevMonth}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                                aria-label={t("common.prevMonth", "Mes anterior")}
                                                title={t("common.prevMonth", "Mes anterior")}
                                            >
                                                <span className="text-lg leading-none">‹</span>
                                            </button>
                                        )}

                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                            <span className="text-xs font-medium text-slate-800">
                                                {selectedLabel ?? ""}
                                            </span>

                                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                                                {selectedSummary.days}{" "}
                                                {String(
                                                    t("pages.vacations.workerPage.days", { defaultValue: "días" }),
                                                )}
                                            </span>
                                        </div>

                                        {showNavArrows && (
                                            <button
                                                type="button"
                                                onClick={goNextMonth}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                                aria-label={t("common.nextMonth", "Mes siguiente")}
                                                title={t("common.nextMonth", "Mes siguiente")}
                                            >
                                                <span className="text-lg leading-none">›</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedSummary && selectionHasPast && (
                                <p className="mt-1 text-[11px] text-rose-700 text-center">
                                    {String(
                                        t("pages.vacations.workerPage.pastDaysBlocked", {
                                            defaultValue: "No puedes seleccionar días pasados.",
                                        }),
                                    )}
                                </p>
                            )}

                            {/* Nota (admin) */}
                            {selectedSummary && (
                                <div className="mt-3">
                                    <textarea
                                        placeholder={String(
                                            t("pages.vacations.altModal.notePlaceholder", {
                                                defaultValue: "Nota para el trabajador…",
                                            }),
                                        )}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-100"
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            )}

                            {/* CTA abajo derecha */}
                            {selectedSummary && (
                                <div className="mt-2 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={!canSubmit}
                                        onClick={() => {
                                            if (!selectedSummary) return;
                                            onSubmit({
                                                startISO: selectedSummary.startISO,
                                                endISO: selectedSummary.endISO,
                                                adminNote,
                                                days: selectedSummary.days,
                                            });
                                        }}
                                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                                    >
                                        {String(t("pages.vacations.altModal.send", { defaultValue: "Enviar" }))}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer (Paso B): solo “Cerrar” */}
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

export default AdminAlternativeOptionModal;


