// frontend/src/components/vacation/AdminVacationMonthModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { IVacationRequest } from "../../types/vacationRequest";
import type { VacationStatus } from "../../types/vacation";
import { filterRequestsByMonth } from "../../utils/vacationMonthUtils";
import { updateVacationRequest, deleteVacationRequest } from "../../api/vacation";
import { invalidateAvailabilityForRange } from "../../utils/vacation/invalidateAvailabilityForRange";
import AlternativeDateModal from "./AlternativeDateModal";
import { useAuth } from "../../hooks/useAuth";
import { toastT } from "../../utils/toast";
import { useTranslation } from "react-i18next";
import { monthLabel as fmtMonth } from "../../utils/intl";
import {
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from "../../api/vacation";
import { emitVacationRequestsUpdated } from "../../utils/vacation/vacationEvents";
import { useVacationAvailabilityInvalidation } from "../../hooks/vacation/useVacationAvailabilityInvalidation";
import AdminVacationRequestsTable from "./AdminVacationRequestsTable";



interface Props {
  isOpen: boolean;
  monthIndex: number | null; // 0..11
  requests: IVacationRequest[];
  year?: number;
  onClose: () => void;
  onActionDone?: () => void;
}

const AdminVacationMonthModal: React.FC<Props> = ({
  isOpen,
  monthIndex,
  requests,
  year = new Date().getFullYear(),
  onClose,
  onActionDone,
}) => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale =
    i18n.language === "de"
      ? "de-DE"
      : i18n.language === "en"
        ? "en-US"
        : "es-ES";

  // ===== Disponibilidad (mini calendario) =====
  type DayState = "green" | "yellow" | "red";
  const [availability, setAvailability] =
    useState<VacationAvailabilityResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const inFlightKeyRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const weekdayHeaders = useMemo(() => {
    const baseMonday = new Date(Date.UTC(2023, 0, 2)); // lunes
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseMonday);
      d.setUTCDate(baseMonday.getUTCDate() + i);
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  // Celdas del mes (42: leading vacías + 1..N + trailing vacías)
  const calendarCells = useMemo(() => {
    if (monthIndex === null) return Array(42).fill(null);
    const y = year;
    const m0 = monthIndex;
    const first = new Date(y, m0, 1);
    const daysInMonth = new Date(y, m0 + 1, 0).getDate();
    const jsFirstDow = first.getDay(); // 0 dom … 6 sab
    const mondayBased = (jsFirstDow + 6) % 7; // lunes=0 … domingo=6

    const leading = Array.from({ length: mondayBased }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const base = [...leading, ...days];
    return base.concat(
      Array.from({ length: Math.max(0, 42 - base.length) }, () => null),
    );
  }, [monthIndex, year]);

  const loadAvailability = async (y: number, m1: number, force = false) => {
    const key = `${y}-${String(m1).padStart(2, "0")}`;
    inFlightKeyRef.current = key;
    try {
      setAvailLoading(true);
      setAvailError(null);
      const data = await getVacationAvailability(
        { year: y, month: m1 },
        { force },
      );
      if (inFlightKeyRef.current !== key) return;
      setAvailability(data);
    } catch {
      if (inFlightKeyRef.current !== key) return;
      setAvailError("load_error");
    } finally {
      if (inFlightKeyRef.current === key) setAvailLoading(false);
    }
  };

  // ==== Resaltado (petición seleccionada) para la lista ====
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (!isOpen) return;
    setHighlightRequestId(null);
  }, [isOpen, monthIndex, year]);

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

  // ========= Estado existente (compactado) =========
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | VacationStatus>("");
  const [sortAsc, setSortAsc] = useState(true);

  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(
    null,
  );
  const [cancelMessage, setCancelMessage] = useState("");
  const [isSendingCancel, setIsSendingCancel] = useState(false);

  const [isAltOpen, setIsAltOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [altInitialStart, setAltInitialStart] = useState<Date>(new Date());
  const [altInitialEnd, setAltInitialEnd] = useState<Date>(new Date());

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const monthLabel = useMemo(() => {
    if (monthIndex === null) return "";
    return fmtMonth(year, monthIndex);
  }, [monthIndex, year]);

  const monthRequests = useMemo(() => {
    if (monthIndex === null) return [];
    return filterRequestsByMonth(requests, monthIndex, year);
  }, [requests, monthIndex, year]);

  const monthCount = monthRequests.length;

  const statusCounts = useMemo(() => {
    const acc = { pending: 0, accepted: 0, cancelled: 0, option_sent: 0 };
    for (const r of monthRequests) acc[r.status]++;
    return acc;
  }, [monthRequests]);

  // aplicar filtros/orden
  const filtered = useMemo(() => {
    let items = monthRequests;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      items = items.filter((r) => {
        const name =
          `${r.user?.name ?? ""} ${r.user?.lastName ?? ""}`.toLowerCase();
        return name.includes(q);
      });
    }
    if (statusFilter) items = items.filter((r) => r.status === statusFilter);
    items = [...items].sort((a, b) => {
      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      return sortAsc ? aStart - bStart : bStart - aStart;
    });
    return items;
  }, [monthRequests, searchText, statusFilter, sortAsc]);


  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { timeZone: "Europe/Berlin" });

  const statusBadge = (status: VacationStatus) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium";
    switch (status) {
      case "accepted":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            {t("pages.vacations.monthModal.filters.accepted")}
          </span>
        );
      case "cancelled":
        return (
          <span className={`${base} bg-red-100 text-red-700`}>
            {t("pages.vacations.monthModal.filters.cancelled")}
          </span>
        );
      case "option_sent":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            {t("pages.vacations.monthModal.filters.option_sent")}
          </span>
        );
      default:
        return (
          <span className={`${base} bg-yellow-100 text-yellow-700`}>
            {t("pages.vacations.monthModal.filters.pending")}
          </span>
        );
    }
  };

  const handleAccept = async (id: string) => {
    if (!token || monthIndex === null) return;
    try {
      await updateVacationRequest(token, id, { status: "accepted" });

      // 🔔 Emitir sincronización a Worker
      emitVacationRequestsUpdated({ type: "updated", id, status: "accepted" });

      // 🟢 Invalidar disponibilidad por rango (cambia capacidad)
      const req = requests.find((r) => r._id === id);
      if (req) {
        invalidateAvailabilityForRange(req.startDate, req.endDate);
      }

      // Refrescar mini-calendario visible
      const m1 = monthIndex + 1;
      window.setTimeout(() => loadAvailability(year, m1, true), 200);

      onActionDone?.();

    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    }
  };

  const openAlternative = async (req: IVacationRequest) => {
    setCurrentRequestId(req._id);

    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    setAltInitialStart(start);
    setAltInitialEnd(end);

    setIsAltOpen(true);
  };

  const handleAlternativeSubmit = async (
    altStartISO: string,
    altEndISO: string,
    note: string,
  ) => {
    if (!token || !currentRequestId || monthIndex === null) return;

    try {
      await updateVacationRequest(token, currentRequestId, {
        status: "option_sent",
        adminOptionStartDate: altStartISO,
        adminOptionEndDate: altEndISO,
        adminNote: note,
      });

      // 🔔 Emitir sincronización al Worker (la propuesta cambia lo que ve)
      emitVacationRequestsUpdated({ type: "updated", id: currentRequestId, status: "option_sent" });


      setIsAltOpen(false);
      setCurrentRequestId(null);
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.loadError"]);
    }
  };


  const handleStartCancelFlow = (id: string) => {
    setCancelingRequestId(id);
    setCancelMessage("");
  };

  const handleConfirmCancel = async (id: string) => {
    if (!token || monthIndex === null) return;
    setIsSendingCancel(true);
    try {
      await updateVacationRequest(token, id, {
        status: "cancelled",
        adminNote: cancelMessage,
      });

      // 🔔 Emitir sincronización a Worker
      emitVacationRequestsUpdated({ type: "updated", id, status: "cancelled" });

      // 🟢 Invalidar disponibilidad por rango (libera capacidad)
      const req = requests.find((r) => r._id === id);
      if (req) {
        invalidateAvailabilityForRange(req.startDate, req.endDate);
      }

      const m1 = monthIndex + 1;
      window.setTimeout(() => loadAvailability(year, m1, true), 200);
      setCancelingRequestId(null);
      setCancelMessage("");
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    } finally {
      setIsSendingCancel(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || monthIndex === null) return;
    if (!window.confirm(t("pages.vacations.monthModal.confirmDelete"))) return;
    try {
      // ⚠️ Guardar el rango ANTES de borrar
      const req = requests.find((r) => r._id === id);
      const startISO = req?.startDate;
      const endISO = req?.endDate;

      await deleteVacationRequest(token, id);

      // 🔔 Emitir sincronización (borrado) — el Worker refrescará su lista
      emitVacationRequestsUpdated({ type: "deleted", id });


      // 🟢 Si el borrado afecta capacidad (p.ej. era 'accepted'), invalidar por rango
      if (startISO && endISO) {
        invalidateAvailabilityForRange(startISO, endISO);
      }


      // Refrescar mini-calendario del mes visible (forzado) tras breve retardo
      const m1 = monthIndex + 1;
      window.setTimeout(() => loadAvailability(year, m1, true), 200);

      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    }
  };

  // 👉 Toggle de resaltado al hacer click en toda la tarjeta (solo UI de lista)
  const toggleHighlightFor = (req: IVacationRequest) => {
    if (highlightRequestId === req._id) {
      setHighlightRequestId(null);
    } else {
      setHighlightRequestId(req._id);
    }
  };


  /** Highlight visual del rango seleccionado (background completo, sin bordes lilas) */
  const buildBorderMapFromRange = (
    start: Date,
    end: Date,
  ): Record<number, string> => {
    if (monthIndex === null) return {};
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const classes: Record<number, string> = {};

    // Limitar rango al mes visible
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex, daysInMonth, 23, 59, 59, 999);

    const s = start < monthStart ? monthStart : start;
    const e = end > monthEnd ? monthEnd : end;
    if (e.getTime() < s.getTime()) return {};

    const startDay = s.getDate();
    const endDay = e.getDate();

    // 🔵 Background visible y claro (no se mezcla con verde/amarillo/rojo)
    for (let d = startDay; d <= endDay; d++) {
      classes[d] =
        (classes[d] ?? '') +
        ' bg-sky-200/70 text-slate-900 ring-1 ring-sky-400';
    }

    // Redondeo tipo “pastilla”
    classes[startDay] = (classes[startDay] ?? '') + ' rounded-l-full';
    classes[endDay] = (classes[endDay] ?? '') + ' rounded-r-full';

    return classes;
  };



  /** Borde SOLO para la solicitud seleccionada que solape el mes visible */
  const borderMap = useMemo(() => {
    if (monthIndex === null || !highlightRequestId) return {};

    // Busca la petición seleccionada
    const sel = requests.find((r) => r._id === highlightRequestId);
    if (!sel) return {};

    // Construye el contorno del rango (se recorta al mes en el helper)
    const s = new Date(sel.startDate);
    const e = new Date(sel.endDate);
    return buildBorderMapFromRange(s, e);
  }, [highlightRequestId, requests, monthIndex, year]);

  if (!isOpen || monthIndex === null) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Panel compacto con layout de columnas y scroll interno */}
        <div
          className="relative z-10 w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vacation-month-modal-title"
        >
          {/* Header compacto y sticky */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <h3
                  id="vacation-month-modal-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {monthLabel} · {year}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  {t("pages.vacations.monthModal.countLine", {
                    count: monthCount,
                  })}
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter("")}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ring-slate-300 ${statusFilter === ""
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                    } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                >
                  {t("pages.vacations.monthModal.filters.all")}
                  {monthCount > 0 ? ` (${monthCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("pending")}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === "pending"
                    ? "bg-amber-500 text-white ring-amber-500"
                    : "bg-white text-amber-700 ring-amber-300 hover:bg-amber-50"
                    } focus:outline-none focus:ring-2 focus:ring-amber-100`}
                >
                  {t("pages.vacations.monthModal.filters.pending")}
                  {statusCounts.pending ? ` (${statusCounts.pending})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("accepted")}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === "accepted"
                    ? "bg-emerald-600 text-white ring-emerald-600"
                    : "bg-white text-emerald-700 ring-emerald-300 hover:bg-emerald-50"
                    } focus:outline-none focus:ring-2 focus:ring-emerald-100`}
                >
                  {t("pages.vacations.monthModal.filters.accepted")}
                  {statusCounts.accepted ? ` (${statusCounts.accepted})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("cancelled")}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === "cancelled"
                    ? "bg-rose-600 text-white ring-rose-600"
                    : "bg-white text-rose-700 ring-rose-300 hover:bg-rose-50"
                    } focus:outline-none focus:ring-2 focus:ring-rose-100`}
                >
                  {t("pages.vacations.monthModal.filters.cancelled")}
                  {statusCounts.cancelled ? ` (${statusCounts.cancelled})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("option_sent")}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === "option_sent"
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-blue-700 ring-blue-300 hover:bg-blue-50"
                    } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                >
                  {t("pages.vacations.monthModal.filters.option_sent")}
                  {statusCounts.option_sent
                    ? ` (${statusCounts.option_sent})`
                    : ""}
                </button>

                <button
                  ref={closeBtnRef}
                  aria-label={t("pages.vacations.monthModal.close")}
                  onClick={onClose}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400
                    focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Contenido scrollable y compacto */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Calendario mini */}
            <div className="rounded-xl ring-1 ring-slate-200 p-2">
              <div className="mb-1 flex items-center gap-3 text-[10px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded border-2 border-emerald-300" />
                  {t("pages.vacations.monthGrid.legend.available")}
                </span>

                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded border-2 border-amber-300" />
                  {t("pages.vacations.monthGrid.legend.requested")}
                </span>

                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded border-2 border-rose-300" />
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

              <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                {weekdayHeaders.map((w, i) => (
                  <div key={i} className="py-0.5">
                    {w}
                  </div>
                ))}
              </div>

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
                    const color =
                      state === "red"
                        ? "bg-rose-50 text-slate-800 border-2 border-rose-300"
                        : state === "yellow"
                          ? "bg-amber-50 text-slate-800 border-2 border-amber-300"
                          : "bg-emerald-50 text-slate-800 border-2 border-emerald-300";

                    // 🟣 Bordes exteriores para formar contorno continuo del rango (todas las aceptadas)
                    const borderCls = borderMap[cell] ?? "";

                    return (
                      <div
                        key={`d-${cell}-${idx}`}
                        className={[
                          "h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none",
                          color,
                          borderCls, // 👈 bordes solo donde toca (top/bottom/left/right)
                        ].join(" ")}
                        title={
                          availability
                            ? `${cell} · ${availability.days.find((d) => d.day === cell)?.approvedCount ?? 0} ${t("pages.vacations.adminPage.badges.accepted", "aceptadas")}`
                            : `${cell}`
                        }
                        aria-label={`${cell}${borderCls ? " · highlighted" : ""}`}
                      >
                        {cell}
                      </div>
                    );
                  })}
              </div>

              {availError && (
                <p className="mt-1 text-[10px] text-rose-600">
                  {t(
                    "common.loadError",
                    "No se pudo cargar la disponibilidad.",
                  )}
                </p>
              )}
            </div>

            {/* Filtros compactos */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <input
                  id="vacation-filter-user"
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t(
                    "pages.vacations.monthModal.filters.userPlaceholder",
                  )}
                  aria-label={t(
                    "pages.vacations.monthModal.filters.userPlaceholder",
                  )}
                  className="w-full sm:w-56 rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <select
                  id="vacation-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label={t(
                    "pages.vacations.monthModal.filters.statusLabel",
                  )}
                  className="rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    {t("pages.vacations.monthModal.filters.all")}
                  </option>
                  <option value="pending">
                    {t("pages.vacations.monthModal.filters.pending")}
                  </option>
                  <option value="accepted">
                    {t("pages.vacations.monthModal.filters.accepted")}
                  </option>
                  <option value="cancelled">
                    {t("pages.vacations.monthModal.filters.cancelled")}
                  </option>
                  <option value="option_sent">
                    {t("pages.vacations.monthModal.filters.option_sent")}
                  </option>
                </select>
              </div>

              <button
                onClick={() => setSortAsc((v) => !v)}
                aria-label={t("pages.vacations.monthModal.filters.sortToggle", {
                  dir: sortAsc
                    ? t("pages.vacations.monthModal.filters.asc")
                    : t("pages.vacations.monthModal.filters.desc"),
                })}
                className="rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {t("pages.vacations.monthModal.filters.sortToggle", {
                  dir: sortAsc
                    ? t("pages.vacations.monthModal.filters.asc")
                    : t("pages.vacations.monthModal.filters.desc"),
                })}
              </button>
            </div>

            {/* Lista compacta (extraída a componente) */}
            <div className="mt-2">
              <AdminVacationRequestsTable
                t={t}
                rows={filtered}
                highlightRequestId={highlightRequestId}
                onToggleHighlight={toggleHighlightFor}
                fmtDate={fmtDate}
                statusBadge={statusBadge}
                onAccept={handleAccept}
                onOpenAlternative={openAlternative}
                onDelete={handleDelete}
                cancelingRequestId={cancelingRequestId}
                cancelMessage={cancelMessage}
                isSendingCancel={isSendingCancel}
                onStartCancelFlow={handleStartCancelFlow}
                onCancelMessageChange={setCancelMessage}
                onConfirmCancel={handleConfirmCancel}
                onAbortCancelFlow={() => {
                  setCancelingRequestId(null);
                  setCancelMessage("");
                }}
              />
            </div>

          </div>

          {/* Footer compacto y sticky */}
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

      <AlternativeDateModal
        isOpen={isAltOpen}
        onClose={() => setIsAltOpen(false)}
        initialStartDate={altInitialStart}
        initialEndDate={altInitialEnd}
        onSubmit={handleAlternativeSubmit}
      />
    </>
  );
};

export default AdminVacationMonthModal;
