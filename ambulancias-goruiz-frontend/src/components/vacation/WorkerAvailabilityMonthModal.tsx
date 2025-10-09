import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getVacationAvailability, type VacationAvailabilityResponse } from '../../api/vacation';
import { monthLabel as fmtMonth } from '../../utils/intl';

type DayState = 'green' | 'yellow' | 'red';

type Props = {
  isOpen: boolean;
  monthIndex: number | null; // 0..11
  year: number;
  onClose: () => void;
  /** ✅ NUEVO: rangos aceptados del trabajador (ISO strings) para dibujar borde violeta */
  acceptedRanges?: Array<{ startISO: string; endISO: string }>;
};

const WorkerAvailabilityMonthModal: React.FC<Props> = ({
  isOpen,
  monthIndex,
  year,
  onClose,
  acceptedRanges = [],
}) => {
  const { t, i18n } = useTranslation();
  const locale =
    i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'es-ES';

  const [availability, setAvailability] = useState<VacationAvailabilityResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  // Control de carreras + cancelación de respuestas tardías
  const inFlightKeyRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  // Cabeceras LUN-DOM (lunes primero)
  const weekdayHeaders = useMemo(() => {
    const baseMonday = new Date(Date.UTC(2023, 0, 2));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseMonday);
      d.setUTCDate(baseMonday.getUTCDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  // Celdas del mes (42)
  const calendarCells = useMemo(() => {
    if (monthIndex === null) return Array(42).fill(null);
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const jsFirstDow = first.getDay(); // 0-dom..6-sab
    const mondayBased = (jsFirstDow + 6) % 7; // 0-lun
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
      if (inFlightKeyRef.current !== key) return; // respuesta vieja
      setAvailability(data);
    } catch {
      if (inFlightKeyRef.current !== key) return;
      setAvailError('load_error');
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

  // Live update: misma pestaña + entre pestañas (BroadcastChannel + storage)
  useEffect(() => {
    if (!isOpen || monthIndex === null) return;

    const myMonth = monthIndex + 1;

    const scheduleRefresh = (y: number, m1: number) => {
      if (y !== year || m1 !== myMonth) return;
      // micro-retardo para evitar carrera con la actualización del backend
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        loadAvailability(year, myMonth, true);
      }, 200);
    };

    // 1) CustomEvent misma pestaña
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { year: number; month: number };
      if (detail?.year && detail?.month) scheduleRefresh(detail.year, detail.month);
    };
    window.addEventListener('vacation-availability-invalidated', customHandler as EventListener);

    // 2) BroadcastChannel entre pestañas
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
    } catch {
      // noop
    }

    // 3) Fallback: storage
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key !== '__vac_av_inval__' || !ev.newValue) return;
      try {
        const payload = JSON.parse(ev.newValue);
        if (payload?.year && payload?.month) scheduleRefresh(payload.year, payload.month);
      } catch {
        // noop
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('vacation-availability-invalidated', customHandler as EventListener);
      window.removeEventListener('storage', storageHandler);
      try { bc?.close?.(); } catch { /* noop */ }
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

  // ✅ NUEVO: ¿el día pertenece a algún rango aceptado del trabajador?
  const isAcceptedDay = (day: number | null): boolean => {
    if (day === null || !acceptedRanges || acceptedRanges.length === 0 || monthIndex === null) return false;
    const date = new Date(year, monthIndex, day, 0, 0, 0, 0);
    const t = date.getTime();

    // Comparación inclusiva por día
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

    for (const r of acceptedRanges) {
      const s = new Date(r.startISO);
      const e = new Date(r.endISO);
      if (t >= startOf(s) && t <= endOf(e)) return true;
    }
    return false;
  };

  const monthTitle =
    typeof fmtMonth === 'function' && monthIndex !== null
      ? fmtMonth(year, monthIndex)
      : monthIndex !== null
        ? new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, monthIndex, 1))
        : '';

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
            <h3 id="worker-availability-month-title" className="text-base font-semibold text-slate-900 truncate">
              {monthTitle} · {year}
            </h3>
            <button
              aria-label={t('pages.vacations.monthModal.close')}
              onClick={onClose}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-2 text-[11px]">
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

          {/* Week headers L–D */}
          <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
            {weekdayHeaders.map((w, i) => (
              <div key={i} className="py-0.5">{w}</div>
            ))}
          </div>

          {/* Calendar grid */}
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

                // ✅ Borde fijo en días aceptados por este trabajador
                const accepted = isAcceptedDay(cell);
                const ring = accepted ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-white' : '';

                return (
                  <div
                    key={`d-${cell}-${idx}`}
                    className={[
                      'h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none',
                      color,
                      ring,
                    ].join(' ')}
                    title={`${cell}`}
                    aria-label={`${cell}${accepted ? ' · accepted' : ''}`}
                  >
                    {cell}
                  </div>
                );
              })}
          </div>

          {availError && (
            <p className="mt-1 text-[11px] text-rose-600">
              {t('common.loadError', 'No se pudo cargar la disponibilidad.')}
            </p>
          )}
        </div>

        {/* Footer */}
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
  );
};

export default WorkerAvailabilityMonthModal;
