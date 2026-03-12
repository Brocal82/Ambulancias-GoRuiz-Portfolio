// frontend/src/components/vacation/AdminVacationMonthModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { IVacationRequest } from "../domain/types";
import type { VacationStatus } from "../../../types/vacation";
import { filterRequestsByMonth } from "../../../utils/vacationMonthUtils";
import { updateVacationRequest, deleteVacationRequest } from "../domain/api";
import { invalidateAvailabilityForRange } from "../utils/invalidateAvailabilityForRange";
import AdminAlternativeOptionModal from "./AdminAlternativeOptionModal";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import { monthLabel as fmtMonth } from "../../../utils/intl";
import {
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from "../domain/api";
import { emitVacationRequestsUpdated } from "../utils/vacationEvents";
import { useVacationAvailabilityInvalidation } from "../hooks/useVacationAvailabilityInvalidation";
import AdminVacationRequestsTable from "../../../components/vacation/AdminVacationRequestsTable";
import { toBerlinDayKey } from "../../../utils/dates/dayKey";
import { vacationRequestFilterPillClass } from "../../../utils/status/vacationRequestUi";

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

  // ✅ Toggle: mostrar/ocultar solicitudes del mes (tabla)
  const [showMonthRequests, setShowMonthRequests] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setHighlightRequestId(null);

    // ✅ SIEMPRE empezar con el desplegable cerrado
    setShowMonthRequests(false);

    // empezar limpio
    setSearchText("");
    setStatusFilter("");
    setSortAsc(true);

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

  // ========= Estado filtros (los dejamos, por ahora) =========
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

  // mes/año visible del modal (flechas)
  const [altMonthIndex, setAltMonthIndex] = useState<number | null>(null);
  const [altYear, setAltYear] = useState<number>(year);

  // rango inicial (preselección)
  const [altInitialStart, setAltInitialStart] = useState<Date | undefined>(undefined);
  const [altInitialEnd, setAltInitialEnd] = useState<Date | undefined>(undefined);


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

  // aplicar filtros/orden (solo sobre las del mes)
  const filtered = useMemo(() => {
    let items = monthRequests;

    // filtro por texto (usuario)
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      items = items.filter((r) => {
        const name = `${r.user?.name ?? ""} ${r.user?.lastName ?? ""}`.toLowerCase();
        return name.includes(q);
      });
    }

    // filtro por estado
    if (statusFilter) items = items.filter((r) => r.status === statusFilter);

    // orden por fecha inicio
    items = [...items].sort((a, b) => {
      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      return sortAsc ? aStart - bStart : bStart - aStart;
    });

    return items;
  }, [monthRequests, searchText, statusFilter, sortAsc]);


  const monthCount = monthRequests.length;

  const statusCounts = useMemo(() => {
    const acc = { pending: 0, accepted: 0, cancelled: 0, option_sent: 0 };
    for (const r of monthRequests) acc[r.status]++;
    return acc;
  }, [monthRequests]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { timeZone: "Europe/Berlin" });


  const handleAccept = async (id: string) => {
    if (!token || monthIndex === null) return;

    const req = requests.find((r) => r._id === id);

    try {
      await updateVacationRequest(token, id, { status: "accepted" });

      emitVacationRequestsUpdated({ type: "updated", id, status: "accepted" });

      if (req) {
        invalidateAvailabilityForRange(req.startDate, req.endDate);
      }

      const m1 = monthIndex + 1;
      window.setTimeout(() => loadAvailability(year, m1, true), 200);

      onActionDone?.();
    } catch (e: any) {
      if (e?.status === 409 && e?.body?.code === "capacity_exceeded") {
        toastT.error(["toasts.vacations.admin.capacityExceeded"]);

        const wantForce = window.confirm(
          t(
            "pages.vacations.adminPage.confirmForceAccept",
            "⚠️ La capacidad está llena para esas fechas.\n\n¿Quieres FORZAR la aceptación igualmente?",
          ),
        );

        if (!wantForce) return;

        try {
          await updateVacationRequest(token, id, {
            status: "accepted",
            force: true,
          });

          emitVacationRequestsUpdated({
            type: "updated",
            id,
            status: "accepted",
          });

          if (req) {
            invalidateAvailabilityForRange(req.startDate, req.endDate);
          }

          const m1 = monthIndex + 1;
          window.setTimeout(() => loadAvailability(year, m1, true), 200);

          onActionDone?.();

          toastT.success([
            "toasts.vacations.admin.forceAccepted",
            { defaultValue: "Aceptada (forzada) ✅" },
          ]);
        } catch {
          toastT.error(["toasts.vacations.admin.error"]);
        }

        return;
      }

      toastT.error(["toasts.vacations.admin.error"]);
    }
  };

  const openAlternative = async (req: IVacationRequest) => {
    setCurrentRequestId(req._id);

    const start = new Date(req.startDate);
    const end = new Date(req.endDate);

    // abrir en el mes del start (UX natural)
    setAltMonthIndex(start.getMonth());
    setAltYear(start.getFullYear());

    // preselección del rango original
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

      // 🔔 Sync (misma pestaña + otras pestañas)
      emitVacationRequestsUpdated({
        type: "updated",
        id: currentRequestId,
        status: "option_sent",
      });

      // 🟢 Invalidar disponibilidad del rango propuesto (refresca grids + modales)
      invalidateAvailabilityForRange(altStartISO, altEndISO);

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

      emitVacationRequestsUpdated({ type: "updated", id, status: "cancelled" });

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
      const req = requests.find((r) => r._id === id);
      const startISO = req?.startDate;
      const endISO = req?.endDate;

      await deleteVacationRequest(token, id);

      emitVacationRequestsUpdated({ type: "deleted", id });

      if (startISO && endISO) {
        invalidateAvailabilityForRange(startISO, endISO);
      }

      const m1 = monthIndex + 1;
      window.setTimeout(() => loadAvailability(year, m1, true), 200);

      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    }
  };

  const toggleHighlightFor = (req: IVacationRequest) => {
    if (highlightRequestId === req._id) {
      setHighlightRequestId(null);
    } else {
      setHighlightRequestId(req._id);
    }
  };

  const buildBorderMapFromRange = (
    start: Date,
    end: Date,
  ): Record<number, string> => {
    if (monthIndex === null) return {};

    const classes: Record<number, string> = {};

    // Mes visible en dayKey (Berlin-day), usando 12:00 para evitar DST edge cases
    const monthStartKey = toBerlinDayKey(
      new Date(year, monthIndex, 1, 12, 0, 0, 0),
    );
    const monthEndKey = toBerlinDayKey(
      new Date(year, monthIndex + 1, 0, 12, 0, 0, 0),
    );

    const sKeyRaw = toBerlinDayKey(start);
    const eKeyRaw = toBerlinDayKey(end);

    if (!monthStartKey || !monthEndKey || !sKeyRaw || !eKeyRaw) return {};

    // Normalizamos por si vienen invertidas
    const sKey = sKeyRaw <= eKeyRaw ? sKeyRaw : eKeyRaw;
    const eKey = sKeyRaw <= eKeyRaw ? eKeyRaw : sKeyRaw;

    // Clamp al mes visible (en keys)
    const clampedStartKey = sKey < monthStartKey ? monthStartKey : sKey;
    const clampedEndKey = eKey > monthEndKey ? monthEndKey : eKey;

    if (clampedEndKey < clampedStartKey) return {};

    // Como ya está clamp al mes, extraer "DD" es seguro (mismo mes)
    const startDay = Number(clampedStartKey.split("-")[2]);
    const endDay = Number(clampedEndKey.split("-")[2]);

    if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return {};

    for (let d = startDay; d <= endDay; d++) {
      classes[d] =
        (classes[d] ?? "") +
        " bg-sky-200/70 text-slate-900 ring-1 ring-sky-400";
    }

    classes[startDay] = (classes[startDay] ?? "") + " rounded-l-full";
    classes[endDay] = (classes[endDay] ?? "") + " rounded-r-full";

    return classes;
  };


  const borderMap = useMemo(() => {
    if (monthIndex === null || !highlightRequestId) return {};

    const sel = requests.find((r) => r._id === highlightRequestId);
    if (!sel) return {};

    const s = new Date(sel.startDate);
    const e = new Date(sel.endDate);
    return buildBorderMapFromRange(s, e);
  }, [highlightRequestId, requests, monthIndex, year]);

  if (!isOpen || monthIndex === null) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div
          className="relative z-10 w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vacation-month-modal-title"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <h3
                  id="vacation-month-modal-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {monthLabel} · {year}
                </h3>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* ✅ Solo contador a la derecha */}
                <span
                  className="inline-flex items-center justify-center rounded-full
    px-3.5 py-1.5 text-[12px]
    font-semibold tabular-nums
    text-slate-900
    bg-white
    border-2 border-slate-300
    shadow-sm"
                >
                  {monthCount}
                </span>



                {/* ✅ Cerrar */}
                <button
                  ref={closeBtnRef}
                  aria-label={t("pages.vacations.monthModal.close")}
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400
      focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  ✕
                </button>
              </div>

            </div>
          </div>

          {/* Contenido */}
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

                    const borderCls = borderMap[cell] ?? "";

                    return (
                      <div
                        key={`d-${cell}-${idx}`}
                        className={[
                          "h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none",
                          color,
                          borderCls,
                        ].join(" ")}
                        title={
                          availability
                            ? `${cell} · ${availability.days.find((d) => d.day === cell)
                              ?.approvedCount ?? 0
                            } ${t(
                              "pages.vacations.adminPage.badges.accepted",
                              "aceptadas",
                            )}`
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
                  {t("common.loadError", "No se pudo cargar la disponibilidad.")}
                </p>
              )}
            </div>

            {/* ✅ Botón 🏖️ (igual que Worker) — debajo del calendario */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowMonthRequests((v) => !v)}
                className={`
                  p-2 rounded-xl border shadow-sm transition
                  ${showMonthRequests
                    ? "bg-slate-200 border-slate-400"
                    : "bg-white border-slate-300 hover:bg-slate-100"
                  }
                `}
                aria-expanded={showMonthRequests}
                aria-label={t(
                  "pages.vacations.adminMonthModal.toggleMonthRequests",
                  "Ver/ocultar solicitudes de este mes",
                )}
                title={t(
                  "pages.vacations.adminMonthModal.toggleMonthRequests",
                  "Ver/ocultar solicitudes de este mes",
                )}
              >
                <span className="text-2xl leading-none">🏖️</span>
              </button>
            </div>

            {/* ✅ Solo si está abierto: mostramos filtros + tabla */}
            {showMonthRequests && (
              <>
                {/* ✅ Filtros pro + buscador (solo dentro del desplegable 🏖️) */}
                <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Buscador */}
                    <div className="min-w-0 sm:shrink-0">
                      <input
                        id="vacation-filter-user"
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder={t("pages.vacations.monthModal.filters.userPlaceholder")}
                        aria-label={t("pages.vacations.monthModal.filters.userPlaceholder")}
                        className="w-full sm:w-[260px] md:w-[320px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm
          focus:outline-none focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    {/* Filtros (minimal, borde color) + sort */}
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <div className="flex items-center gap-2">
                        {/* ⭐ Todas */}
                        <button
                          type="button"
                          onClick={() => setStatusFilter("")}
                          aria-pressed={statusFilter === ""}
                          title={t("pages.vacations.monthModal.filters.all") as string}
                          className={[
                            "inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition",
                            statusFilter === ""
                              ? "border-slate-400 ring-2 ring-slate-200 text-slate-900"
                              : "border-slate-300 text-slate-600 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          <span className="text-[16px] leading-none">⭐</span>
                        </button>

                        {/* Pending (ámbar) */}
                        <button
                          type="button"
                          onClick={() => setStatusFilter("pending")}
                          aria-pressed={statusFilter === "pending"}
                          title={t("pages.vacations.monthModal.filters.pending") as string}
                          className={vacationRequestFilterPillClass("pending", statusFilter === "pending")}

                        >
                          {statusCounts.pending}
                        </button>

                        {/* Accepted (verde) */}
                        <button
                          type="button"
                          onClick={() => setStatusFilter("accepted")}
                          aria-pressed={statusFilter === "accepted"}
                          title={t("pages.vacations.monthModal.filters.accepted") as string}
                          className={vacationRequestFilterPillClass("accepted", statusFilter === "accepted")}

                        >
                          {statusCounts.accepted}
                        </button>

                        {/* Cancelled (rojo) */}
                        <button
                          type="button"
                          onClick={() => setStatusFilter("cancelled")}
                          aria-pressed={statusFilter === "cancelled"}
                          title={t("pages.vacations.monthModal.filters.cancelled") as string}
                          className={vacationRequestFilterPillClass("cancelled", statusFilter === "cancelled")}

                        >
                          {statusCounts.cancelled}
                        </button>

                        {/* Option sent (azul) */}
                        <button
                          type="button"
                          onClick={() => setStatusFilter("option_sent")}
                          aria-pressed={statusFilter === "option_sent"}
                          title={t("pages.vacations.monthModal.filters.option_sent") as string}
                          className={vacationRequestFilterPillClass("option_sent", statusFilter === "option_sent")}

                        >
                          {statusCounts.option_sent}
                        </button>
                      </div>

                      {/* Orden (minimal) */}
                      <button
                        type="button"
                        onClick={() => setSortAsc((v) => !v)}
                        aria-label={t("pages.vacations.monthModal.filters.sortToggle", {
                          dir: sortAsc
                            ? t("pages.vacations.monthModal.filters.asc")
                            : t("pages.vacations.monthModal.filters.desc"),
                        }) as string}
                        title={t("pages.vacations.monthModal.filters.sortToggle", {
                          dir: sortAsc
                            ? t("pages.vacations.monthModal.filters.asc")
                            : t("pages.vacations.monthModal.filters.desc"),
                        }) as string}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs shadow-sm hover:bg-slate-50
          focus:outline-none focus:ring-4 focus:ring-blue-100"
                      >
                        {sortAsc ? "⬆️" : "⬇️"}
                      </button>
                    </div>
                  </div>
                </div>




                {/* Tabla */}
                <div className="mt-2">
                  <AdminVacationRequestsTable
                    t={t}
                    rows={filtered}
                    highlightRequestId={highlightRequestId}
                    onToggleHighlight={toggleHighlightFor}
                    fmtDate={fmtDate}
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
              </>
            )}
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

      <AdminAlternativeOptionModal
        isOpen={isAltOpen}
        monthIndex={altMonthIndex}
        year={altYear}
        onClose={() => setIsAltOpen(false)}
        initialStartDate={altInitialStart}
        initialEndDate={altInitialEnd}
        onNavigateMonth={(next) => {
          setAltYear(next.year);
          setAltMonthIndex(next.monthIndex);
        }}
        onSubmit={({ startISO, endISO, adminNote }) => {
          handleAlternativeSubmit(startISO, endISO, adminNote);
        }}
      />

    </>
  );
};

export default AdminVacationMonthModal;



