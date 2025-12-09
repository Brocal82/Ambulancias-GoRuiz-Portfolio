// frontend/src/components/vacation/AdminVacationMonthModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { filterRequestsByMonth } from '../../utils/vacationMonthUtils';
import {
  updateVacationRequest,
  deleteVacationRequest,
  invalidateThisAndNextMonth,
  invalidateAvailabilityByRange, // 👈 NUEVO
} from '../../api/vacation';
import AlternativeDateModal from './AlternativeDateModal';
import { useAuth } from '../../hooks/useAuth';
import { toastT } from "../../utils/toast";
import { useTranslation } from 'react-i18next';
import { monthLabel as fmtMonth } from '../../utils/intl';
import { getVacationAvailability, type VacationAvailabilityResponse } from '../../api/vacation';

type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';

const calcDays = (startISO: string, endISO: string) => {
  const s = new Date(startISO);
  const e = new Date(endISO);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return Number.isNaN(diff) ? '—' : Math.max(diff, 1);
};


interface Props {
  isOpen: boolean;
  monthIndex: number | null; // 0..11
  requests: IVacationRequest[];
  year?: number;
  onClose: () => void;
  onActionDone?: () => void;
}

// ✅ Helper mínimo para sincronizar Worker sin recargar (incluye fallback por storage)
function emitVacationSync(payload: { id: string; status: 'accepted' | 'cancelled' | 'deleted'; ts?: number }) {
  const detail = { ts: Date.now(), ...payload };

  // Misma pestaña
  try {
    window.dispatchEvent(new CustomEvent('vacation-requests-updated', { detail }));
  } catch { }

  // Otras pestañas/ventanas (canal dedicado)
  try {
    const bc = new BroadcastChannel('vacations');
    bc.postMessage({ type: 'requests-updated', ...detail });
    bc.close?.();
  } catch { }

  // 🔁 Fallback universal: dispara evento 'storage' en otras pestañas
  try {
    localStorage.setItem('__vac_req_upd__', JSON.stringify(detail));
    setTimeout(() => {
      try { localStorage.removeItem('__vac_req_upd__'); } catch { }
    }, 500);
  } catch { }
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
    i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'es-ES';

  // ===== Disponibilidad (mini calendario) =====
  type DayState = 'green' | 'yellow' | 'red';
  const [availability, setAvailability] = useState<VacationAvailabilityResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const inFlightKeyRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const weekdayHeaders = useMemo(() => {
    const baseMonday = new Date(Date.UTC(2023, 0, 2)); // lunes
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseMonday);
      d.setUTCDate(baseMonday.getUTCDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
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
    return base.concat(Array.from({ length: Math.max(0, 42 - base.length) }, () => null));
  }, [monthIndex, year]);

  const loadAvailability = async (y: number, m1: number, force = false) => {
    const key = `${y}-${String(m1).padStart(2, '0')}`;
    inFlightKeyRef.current = key;
    try {
      setAvailLoading(true);
      setAvailError(null);
      const data = await getVacationAvailability({ year: y, month: m1 }, { force });
      if (inFlightKeyRef.current !== key) return;
      setAvailability(data);
    } catch {
      if (inFlightKeyRef.current !== key) return;
      setAvailError('load_error');
    } finally {
      if (inFlightKeyRef.current === key) setAvailLoading(false);
    }
  };

  // ==== Resaltado (petición seleccionada) para la lista ====
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);

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

  // Live update: escucha invalidaciones para refrescar mini-calendario
  useEffect(() => {
    if (!isOpen || monthIndex === null) return;
    const myMonth = monthIndex + 1;

    const scheduleRefresh = (y: number, m1: number) => {
      if (y !== year || m1 !== myMonth) return;
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        loadAvailability(year, myMonth, true);
      }, 200);
    };

    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { year: number; month: number };
      if (detail?.year && detail?.month) scheduleRefresh(detail.year, detail.month);
    };
    window.addEventListener('vacation-availability-invalidated', customHandler as EventListener);

    // BroadcastChannel entre pestañas
    let bc: BroadcastChannel | null = null;
    try {
      const BC = (window as any).BroadcastChannel as
        | (new (name: string) => BroadcastChannel)
        | undefined;
      if (typeof BC === 'function') {
        bc = new BC('vacations');
        bc.onmessage = (msg: MessageEvent) => {
          const data = msg.data || {};
          if (data?.type === 'availability-invalidated' && data.year && data.month) {
            scheduleRefresh(data.year, data.month);
          }
        };
      }
    } catch { }

    // Fallback: storage
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key !== '__vac_av_inval__' || !ev.newValue) return;
      try {
        const payload = JSON.parse(ev.newValue);
        if (payload?.year && payload?.month) scheduleRefresh(payload.year, payload.month);
      } catch { }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('vacation-availability-invalidated', customHandler as EventListener);
      window.removeEventListener('storage', storageHandler);
      try { bc?.close?.(); } catch { }
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isOpen, monthIndex, year]);

  const getDayState = (day: number | null): DayState | null => {
    if (!availability || day === null) return null;
    const rec = availability.days.find(d => d.day === day);
    return rec ? rec.state : 'green';
  };

  // ========= Estado existente (compactado) =========
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | VacationStatus>('');
  const [sortAsc, setSortAsc] = useState(true);

  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');
  const [isSendingCancel, setIsSendingCancel] = useState(false);

  const [isAltOpen, setIsAltOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [altInitialStart, setAltInitialStart] = useState<Date>(new Date());
  const [altInitialEnd, setAltInitialEnd] = useState<Date>(new Date());

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const monthLabel = useMemo(() => {
    if (monthIndex === null) return '';
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
      items = items.filter(r => {
        const name = `${r.user?.name ?? ''} ${r.user?.lastName ?? ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    if (statusFilter) items = items.filter(r => r.status === statusFilter);
    items = [...items].sort((a, b) => {
      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      return sortAsc ? aStart - bStart : bStart - aStart;
    });
    return items;
  }, [monthRequests, searchText, statusFilter, sortAsc]);

  // Invalida el mes visible en el modal (y el siguiente) para refresco en vivo
  const invalidateVisibleMonth = () => {
    if (monthIndex === null) return;
    invalidateThisAndNextMonth(year, monthIndex + 1);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { timeZone: 'Europe/Berlin' });

  const statusBadge = (status: VacationStatus) => {
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium';
    switch (status) {
      case 'accepted':
        return <span className={`${base} bg-green-100 text-green-700`}>{t('pages.vacations.monthModal.filters.accepted')}</span>;
      case 'cancelled':
        return <span className={`${base} bg-red-100 text-red-700`}>{t('pages.vacations.monthModal.filters.cancelled')}</span>;
      case 'option_sent':
        return <span className={`${base} bg-blue-100 text-blue-700`}>{t('pages.vacations.monthModal.filters.option_sent')}</span>;
      default:
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>{t('pages.vacations.monthModal.filters.pending')}</span>;
    }
  };

  const handleAccept = async (id: string) => {
    if (!token || monthIndex === null) return;
    try {
      await updateVacationRequest(token, id, { status: 'accepted' });
      // 🔔 Emitir sincronización a Worker (después del await)
      emitVacationSync({ id, status: 'accepted' });

      // Invalidar y refrescar mini-calendario visible
      invalidateVisibleMonth();
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

  const handleAlternativeSubmit = async (altStartISO: string, altEndISO: string, note: string) => {
    if (!token || !currentRequestId || monthIndex === null) return;
    try {
      await updateVacationRequest(token, currentRequestId, {
        status: 'option_sent',
        adminOptionStartDate: altStartISO,
        adminOptionEndDate: altEndISO,
        adminNote: note,
      });
      setIsAltOpen(false);
      setCurrentRequestId(null);
      // ⚠️ option_sent no cambia estado final del worker → no emitimos
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.loadError"]);
    }
  };

  const handleStartCancelFlow = (id: string) => {
    setCancelingRequestId(id);
    setCancelMessage('');
  };

  const handleConfirmCancel = async (id: string) => {
    if (!token || monthIndex === null) return;
    setIsSendingCancel(true);
    try {
      await updateVacationRequest(token, id, { status: 'cancelled', adminNote: cancelMessage });

      // 🔔 Emitir sincronización a Worker
      emitVacationSync({ id, status: 'cancelled' });

      invalidateVisibleMonth();
      const m1 = monthIndex + 1;
      window.setTimeout(() => loadAvailability(year, m1, true), 200);
      setCancelingRequestId(null);
      setCancelMessage('');
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    } finally {
      setIsSendingCancel(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || monthIndex === null) return;
    if (!window.confirm(t('pages.vacations.monthModal.confirmDelete'))) return;
    try {
      // ⚠️ Guardar el rango ANTES de borrar
      const req = requests.find(r => r._id === id);
      const startISO = req?.startDate;
      const endISO = req?.endDate;

      await deleteVacationRequest(token, id);

      // 🔔 Emitir sincronización (borrado) — el Worker refrescará su lista
      emitVacationSync({ id, status: 'deleted' });

      // 🟢 Si el borrado libera capacidad (p.ej. era 'accepted'), invalidar por rango
      if (startISO && endISO) {
        try {
          invalidateAvailabilityByRange(startISO, endISO);
        } catch { }
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

  // =========================
  // 🔳 BORDES CONTIGUOS (contorno continuo) para TODAS las aceptadas del mes visible
  // =========================

  /** Construye las clases de borde por día para un rango (ajustado al mes visible) */
  const buildBorderMapFromRange = (start: Date, end: Date): Record<number, string> => {
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

    // Columna (1..7) tomando lunes como primer día
    const colOf = (day: number) => {
      const d = new Date(year, monthIndex!, day);
      const js = d.getDay(); // 0-dom..6-sab
      return ((js + 6) % 7) + 1; // 1-lun..7-dom
    };

    // Recorremos por semanas, uniendo con líneas superior/inferior y laterales
    let cur = startDay;
    while (cur <= endDay) {
      const colStart = colOf(cur);
      const lastDayOfWeek = Math.min(endDay, cur + (7 - colStart));

      // línea superior solo en la primera semana del rango
      if (cur === startDay) {
        for (let d = cur; d <= lastDayOfWeek; d++) {
          classes[d] = (classes[d] ?? '') + ' border-t-2 border-violet-500';
        }
      }
      // línea inferior solo en la última semana del rango
      if (lastDayOfWeek === endDay) {
        for (let d = cur; d <= lastDayOfWeek; d++) {
          classes[d] = (classes[d] ?? '') + ' border-b-2 border-violet-500';
        }
      }

      // laterales
      classes[cur] = (classes[cur] ?? '') + ' border-l-2 border-violet-500';
      classes[lastDayOfWeek] = (classes[lastDayOfWeek] ?? '') + ' border-r-2 border-violet-500';

      cur = lastDayOfWeek + 1;
    }

    // Puntas redondeadas
    classes[startDay] = (classes[startDay] ?? '') + ' rounded-l-full';
    classes[endDay] = (classes[endDay] ?? '') + ' rounded-r-full';

    return classes;
  };


  /** Borde SOLO para la solicitud seleccionada que solape el mes visible */
  const borderMap = useMemo(() => {
    if (monthIndex === null || !highlightRequestId) return {};

    // Busca la petición seleccionada
    const sel = requests.find(r => r._id === highlightRequestId);
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
                <h3 id="vacation-month-modal-title" className="text-base font-semibold text-slate-900">
                  {monthLabel} · {year}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  {t('pages.vacations.monthModal.countLine', { count: monthCount })}
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('')}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ring-slate-300 ${statusFilter === '' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                >
                  {t('pages.vacations.monthModal.filters.all')}
                  {monthCount > 0 ? ` (${monthCount})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === 'pending'
                    ? 'bg-amber-500 text-white ring-amber-500'
                    : 'bg-white text-amber-700 ring-amber-300 hover:bg-amber-50'
                    } focus:outline-none focus:ring-2 focus:ring-amber-100`}
                >
                  {t('pages.vacations.monthModal.filters.pending')}
                  {statusCounts.pending ? ` (${statusCounts.pending})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('accepted')}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === 'accepted'
                    ? 'bg-emerald-600 text-white ring-emerald-600'
                    : 'bg-white text-emerald-700 ring-emerald-300 hover:bg-emerald-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-100`}
                >
                  {t('pages.vacations.monthModal.filters.accepted')}
                  {statusCounts.accepted ? ` (${statusCounts.accepted})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('cancelled')}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === 'cancelled'
                    ? 'bg-rose-600 text-white ring-rose-600'
                    : 'bg-white text-rose-700 ring-rose-300 hover:bg-rose-50'
                    } focus:outline-none focus:ring-2 focus:ring-rose-100`}
                >
                  {t('pages.vacations.monthModal.filters.cancelled')}
                  {statusCounts.cancelled ? ` (${statusCounts.cancelled})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('option_sent')}
                  className={`rounded-full px-2.5 py-1 text-[10px] ring-1 ${statusFilter === 'option_sent'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-blue-700 ring-blue-300 hover:bg-blue-50'
                    } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                >
                  {t('pages.vacations.monthModal.filters.option_sent')}
                  {statusCounts.option_sent ? ` (${statusCounts.option_sent})` : ''}
                </button>

                <button
                  ref={closeBtnRef}
                  aria-label={t('pages.vacations.monthModal.close')}
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
              <div className="mb-1 flex items-center gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-green-500" />
                  {t('pages.vacations.monthGrid.legend.available')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-yellow-400" />
                  {t('pages.vacations.monthGrid.legend.requested')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-red-500" />
                  {t('pages.vacations.monthGrid.legend.full')}
                </span>

                {availability && (
                  <span className="ml-auto text-slate-500">
                    {t('pages.vacations.adminPage.capacity', { count: availability.maxPerDay })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                {weekdayHeaders.map((w, i) => (
                  <div key={i} className="py-0.5">{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {availLoading &&
                  Array.from({ length: 42 }).map((_, i) => (
                    <div key={`sk-${i}`} className="h-6 sm:h-7 md:h-8 rounded bg-slate-100 animate-pulse" />
                  ))}

                {!availLoading &&
                  calendarCells.map((cell, idx) => {
                    if (cell === null) {
                      return <div key={`empty-${idx}`} className="h-6 sm:h-7 md:h-8 rounded bg-transparent" />;
                    }

                    const state = getDayState(cell);
                    const color =
                      state === 'red'
                        ? 'bg-red-500 text-white'
                        : state === 'yellow'
                          ? 'bg-yellow-400 text-slate-900'
                          : 'bg-green-500 text-white';

                    // 🟣 Bordes exteriores para formar contorno continuo del rango (todas las aceptadas)
                    const borderCls = borderMap[cell] ?? '';

                    return (
                      <div
                        key={`d-${cell}-${idx}`}
                        className={[
                          'h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none',
                          color,
                          borderCls, // 👈 bordes solo donde toca (top/bottom/left/right)
                        ].join(' ')}
                        title={
                          availability
                            ? `${cell} · ${availability.days.find(d => d.day === cell)?.approvedCount ?? 0} ${t('pages.vacations.adminPage.badges.accepted', 'aceptadas')}`
                            : `${cell}`
                        }
                        aria-label={`${cell}${borderCls ? ' · highlighted' : ''}`}
                      >
                        {cell}
                      </div>
                    );
                  })}
              </div>

              {availError && (
                <p className="mt-1 text-[10px] text-rose-600">
                  {t('common.loadError', 'No se pudo cargar la disponibilidad.')}
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
                  placeholder={t('pages.vacations.monthModal.filters.userPlaceholder')}
                  aria-label={t('pages.vacations.monthModal.filters.userPlaceholder')}
                  className="w-full sm:w-56 rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <select
                  id="vacation-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label={t('pages.vacations.monthModal.filters.statusLabel')}
                  className="rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">{t('pages.vacations.monthModal.filters.all')}</option>
                  <option value="pending">{t('pages.vacations.monthModal.filters.pending')}</option>
                  <option value="accepted">{t('pages.vacations.monthModal.filters.accepted')}</option>
                  <option value="cancelled">{t('pages.vacations.monthModal.filters.cancelled')}</option>
                  <option value="option_sent">{t('pages.vacations.monthModal.filters.option_sent')}</option>
                </select>
              </div>

              <button
                onClick={() => setSortAsc((v) => !v)}
                aria-label={t('pages.vacations.monthModal.filters.sortToggle', {
                  dir: sortAsc ? t('pages.vacations.monthModal.filters.asc') : t('pages.vacations.monthModal.filters.desc')
                })}
                className="rounded-lg border border-slate-300 ring-1 ring-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {t('pages.vacations.monthModal.filters.sortToggle', {
                  dir: sortAsc ? t('pages.vacations.monthModal.filters.asc') : t('pages.vacations.monthModal.filters.desc')
                })}
              </button>
            </div>

            {/* Lista compacta como tabla: Trabajador · Fechas · Días · Estado · Acciones */}
            <div className="mt-2">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-slate-500">
                  {t('pages.vacations.monthModal.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-xs shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden text-center">

                    <colgroup>
                      <col className="w-[24%]" /> {/* Trabajador */}
                      <col className="w-[30%]" /> {/* Fechas */}
                      <col className="w-[10%]" /> {/* Días */}
                      <col className="w-[16%]" /> {/* Estado */}
                      <col className="w-[20%]" /> {/* Acciones */}
                    </colgroup>

                    <thead className="bg-slate-50">
                      <tr className="text-slate-600 border-b border-slate-200 text-center">
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                          {t('pages.vacations.adminPage.table.user', 'Trabajador')}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                          {t('pages.vacations.adminPage.table.dates', 'Fechas')}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                          {t('pages.vacations.adminPage.table.days', 'Días')}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                          {t('pages.vacations.adminPage.table.status', 'Estado')}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                          {t('pages.vacations.adminPage.table.actions', 'Acciones')}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                      {filtered.map((req) => {
                        const isActive = highlightRequestId === req._id;
                        const days = calcDays(req.startDate, req.endDate);

                        const hasProposal =
                          !!req.adminOptionStartDate && !!req.adminOptionEndDate;

                        return (
                          <tr
                            key={req._id}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('button, textarea')) return;
                              toggleHighlightFor(req);
                            }}
                            className={[
                              'border-t border-slate-200 cursor-pointer transition-colors',
                              isActive ? 'bg-violet-50' : 'hover:bg-slate-50',
                            ].join(' ')}
                          >
                            {/* Trabajador */}
                            <td className="px-2 py-2 text-center align-top">
                              <div className="text-[11px] font-medium text-slate-900 truncate">
                                {req.user
                                  ? `${req.user.lastName}, ${req.user.name}`
                                  : t('pages.vacations.adminPage.userMissing', 'Usuario no disponible')}
                              </div>
                              {req.adminNote && (
                                <div className="mt-0.5 text-[10px] text-slate-600 line-clamp-2">
                                  <span className="font-semibold">
                                    {t('pages.vacations.adminPage.badges.note', 'Nota:')}{' '}
                                  </span>
                                  {req.adminNote}
                                </div>
                              )}
                            </td>

                            {/* Fechas (solicitadas + propuesta jefe en azul) */}
                            <td className="px-2 py-2 text-center align-top">
                              <div className="text-[11px] text-slate-800 whitespace-nowrap">
                                {fmtDate(req.startDate)} — {fmtDate(req.endDate)}
                              </div>

                              {hasProposal && (
                                <div
                                  className="mt-1 inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-sky-600">📅</span>
                                  <span>
                                    {t(
                                      'pages.vacations.adminPage.badges.proposal',
                                      'Propuesta:'
                                    )}{' '}
                                    {fmtDate(req.adminOptionStartDate!)} —{' '}
                                    {fmtDate(req.adminOptionEndDate!)}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Días */}
                            <td className="px-2 py-2 text-center align-top whitespace-nowrap">
                              {days}
                            </td>

                            {/* Estado */}
                            <td className="px-2 py-2 text-center align-top whitespace-nowrap">
                              {statusBadge(req.status)}
                            </td>

                            {/* Acciones */}
                            <td className="px-2 py-2 text-center align-top whitespace-nowrap">

                              {cancelingRequestId === req._id ? (
                                <div
                                  className="w-full rounded-lg ring-1 ring-slate-200 p-1.5 bg-white"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <textarea
                                    className="w-full resize-none rounded-lg border border-slate-300 ring-1 ring-slate-200 p-1.5 text-[10px] leading-snug focus:outline-none focus:ring-2 focus:ring-rose-100"
                                    placeholder={t(
                                      'pages.vacations.adminPage.actions.cancelMessagePlaceholder'
                                    )}
                                    rows={3}
                                    value={cancelMessage}
                                    onChange={(e) => setCancelMessage(e.target.value)}
                                  />
                                  <div className="mt-1 flex gap-1.5 justify-end">
                                    <button
                                      className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:opacity-50"
                                      disabled={isSendingCancel}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleConfirmCancel(req._id);
                                      }}
                                    >
                                      {isSendingCancel
                                        ? t('pages.vacations.adminPage.actions.sending')
                                        : t(
                                          'pages.vacations.adminPage.actions.confirmRejection',
                                          'Confirmar'
                                        )}
                                    </button>
                                    <button
                                      className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                                      disabled={isSendingCancel}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancelingRequestId(null);
                                        setCancelMessage('');
                                      }}
                                    >
                                      {t('pages.vacations.adminPage.actions.cancel', 'Cancelar')}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  {req.status === 'pending' && (
                                    <>
                                      {/* ✅ ACEPTAR */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAccept(req._id);
                                        }}
                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                        title={t(
                                          'pages.vacations.adminPage.actions.accept',
                                          'Aceptar'
                                        )}
                                      >
                                        ✅
                                      </button>

                                      {/* 🔄 ALTERNATIVA */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openAlternative(req);
                                        }}
                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        title={t(
                                          'pages.vacations.adminPage.actions.altOption',
                                          'Proponer alternativa'
                                        )}
                                      >
                                        🔄
                                      </button>

                                      {/* ❌ CANCELAR (inicia flujo con textarea) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartCancelFlow(req._id);
                                        }}
                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-100"
                                        title={t(
                                          'pages.vacations.adminPage.actions.cancel',
                                          'Rechazar / cancelar'
                                        )}
                                      >
                                        ❌
                                      </button>
                                    </>
                                  )}

                                  {(req.status === 'accepted' ||
                                    req.status === 'cancelled') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(req._id);
                                        }}
                                        aria-label={t(
                                          'pages.vacations.adminPage.actions.delete',
                                          'Eliminar'
                                        )}
                                        title={t(
                                          'pages.vacations.adminPage.actions.delete',
                                          'Eliminar'
                                        )}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full
                                        bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400
                                        focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Footer compacto y sticky */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-end">
            <button
              onClick={onClose}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {t('pages.vacations.monthModal.close')}
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
