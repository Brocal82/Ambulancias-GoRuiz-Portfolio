// src/components/vacation/VacationRequestForm.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { startOfDay } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useAuth } from '../../hooks/useAuth';
import {
  createVacationRequest,
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from '../../api/vacation';
import { useTranslation } from 'react-i18next';
import { es as dfEs, de as dfDe, enGB as dfEnGB } from 'date-fns/locale';

interface VacationRequestFormProps {
  onSuccess?: () => void;
}

/* Helpers para evitar renders innecesarios */
const sameNumArray = (a: number[] | undefined, b: number[]) => {
  if (!a) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const sameDateArray = (a: Date[], b: Date[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].getTime() !== b[i].getTime()) return false;
  return true;
};

const VacationRequestForm: React.FC<VacationRequestFormProps> = ({ onSuccess }) => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  // Locale: semana empieza en LUNES
  const pickerLocale = useMemo(
    () => (i18n.language.startsWith('de') ? dfDe : i18n.language.startsWith('es') ? dfEs : dfEnGB),
    [i18n.language]
  );

const [selectionRange, setSelectionRange] = useState({
  startDate: startOfDay(new Date()),
  endDate: startOfDay(new Date()),
  key: 'selection' as const,
});

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Días bloqueados (rojos) y caché por mes
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [redDaysByMonth, setRedDaysByMonth] = useState<Record<string, number[]>>({});

  // Evitar peticiones duplicadas
  const inflightRef = useRef<Record<string, Promise<void> | undefined>>({});
  const monthKey = (y: number, m1: number) => `${y}-${String(m1).padStart(2, '0')}`;

  // Cargar disponibilidad de un mes (sin duplicados ni carreras)
  const ensureMonthLoaded = useCallback(
    async (y: number, m1: number) => {
      const key = monthKey(y, m1);
      if (loadedMonths[key] || inflightRef.current[key]) return;

      inflightRef.current[key] = (async () => {
        try {
          const data: VacationAvailabilityResponse = await getVacationAvailability({ year: y, month: m1 });
          const redDays = data.days
            .filter(d => d.state === 'red')
            .map(d => d.day)
            .sort((a, b) => a - b);

          setRedDaysByMonth(prev =>
            sameNumArray(prev[key], redDays) ? prev : { ...prev, [key]: redDays }
          );
          setLoadedMonths(prev => (prev[key] ? prev : { ...prev, [key]: true }));
        } finally {
          inflightRef.current[key] = undefined;
        }
      })();
    },
    [loadedMonths] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Construir disabledDates cuando cambia el mapa de días rojos
  useEffect(() => {
    const dates: Date[] = [];
    Object.entries(redDaysByMonth).forEach(([k, dayNums]) => {
      const [y, m] = k.split('-').map(Number);
      for (const d of dayNums) dates.push(new Date(y, m - 1, d, 0, 0, 0, 0));
    });
    setDisabledDates(prev => (sameDateArray(prev, dates) ? prev : dates));
  }, [redDaysByMonth]);

  // Carga inicial: mes actual + siguiente
  useEffect(() => {
    const base = selectionRange.startDate ?? new Date();
    const y = base.getFullYear();
    const m1 = base.getMonth() + 1;
    const next = m1 === 12 ? { year: y + 1, month: 1 } : { year: y, month: m1 + 1 };
    ensureMonthLoaded(y, m1);
    ensureMonthLoaded(next.year, next.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selección de rango (estable, sin tocar nada en navegación pura)
  const handleSelect = useCallback(
    (ranges: RangeKeyDict) => {
      const next = ranges.selection;
      const hasStart = next.startDate instanceof Date;
      const hasEnd = next.endDate instanceof Date;

      // Navegación interna sin fechas: no tocar rango
      if (!hasStart && !hasEnd) return;

      setSelectionRange(prev => ({
        ...prev,
        startDate: hasStart ? (next.startDate as Date) : prev.startDate,
        endDate: hasEnd ? (next.endDate as Date) : prev.endDate,
        key: 'selection',
      }));

      // Precarga meses implicados (sin re-anclar el calendario)
      if (hasStart) {
        const sy = (next.startDate as Date).getFullYear();
        const sm1 = (next.startDate as Date).getMonth() + 1;
        const nm = sm1 === 12 ? { year: sy + 1, month: 1 } : { year: sy, month: sm1 + 1 };
        ensureMonthLoaded(sy, sm1);
        ensureMonthLoaded(nm.year, nm.month);
      }
      if (hasEnd) {
        const ey = (next.endDate as Date).getFullYear();
        const em1 = (next.endDate as Date).getMonth() + 1;
        const nm = em1 === 12 ? { year: ey + 1, month: 1 } : { year: ey, month: em1 + 1 };
        ensureMonthLoaded(ey, em1);
        ensureMonthLoaded(nm.year, nm.month);
      }
    },
    [ensureMonthLoaded]
  );

  // Validación extra: ¿el rango contiene algún día bloqueado?
  const rangeContainsDisabled = (start: Date, end: Date) => {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    for (const d of disabledDates) {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (t >= s && t <= e) return true;
    }
    return false;
  };

  // NUEVO: asegurar que todos los meses del rango están cargados justo antes de validar/enviar
  const ensureAllMonthsInRangeLoaded = async (start: Date, end: Date) => {
    // Primer día de mes para start y end
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);

    const jobs: Promise<void>[] = [];
    for (
      let y = s.getFullYear(), m = s.getMonth();
      y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth());
    ) {
      const m1 = m + 1; // 1..12
      jobs.push(ensureMonthLoaded(y, m1));
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    await Promise.all(jobs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage(t('pages.vacations.requestForm.mustLogin'));
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      // 👇 Asegura que todos los meses entre start y end estén cargados
      await ensureAllMonthsInRangeLoaded(selectionRange.startDate, selectionRange.endDate);

      // Validar con todos los días rojos ya en memoria
      if (rangeContainsDisabled(selectionRange.startDate, selectionRange.endDate)) {
        setMessage(t('pages.vacations.requestForm.rangeBlocked', 'El rango contiene días sin disponibilidad.'));
        return;
      }

      await createVacationRequest(token, {
        startDate: selectionRange.startDate.toISOString(),
        endDate: selectionRange.endDate.toISOString(),
      });
      setMessage(t('pages.vacations.requestForm.success'));
      onSuccess?.();
    } catch {
      setMessage(t('pages.vacations.requestForm.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* Estilos locales SOLO para este componente */}
      <style>{`
        .vacation-range .rdrDateRangeWrapper,
        .vacation-range .rdrCalendarWrapper,
        .vacation-range .rdrMonths,
        .vacation-range .rdrMonth { width: 100%; }
      `}</style>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">
        {t('pages.vacations.requestForm.title')}
      </h2>

      <div className="vacation-range rounded-xl ring-1 ring-slate-200 overflow-hidden w-full">
        <DateRange
          className="w-full"
          ranges={[selectionRange]}
          onChange={handleSelect}
          moveRangeOnFirstSelection={false}
          minDate={startOfDay(new Date())}
          maxDate={new Date(2035, 11, 31)}
          disabledDates={disabledDates}
          locale={pickerLocale}
          /* Props que mejoran estabilidad visual sin re-anclar */
          preventSnapRefocus
          calendarFocus="forwards"
          fixedHeight
          /* Sin onShownDateChange para evitar saltos al cambiar mes/año */
        />
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message === t('pages.vacations.requestForm.success') ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {message}
        </p>
      )}

      <button
        disabled={loading}
        onClick={handleSubmit}
        className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
      >
        {loading ? t('pages.vacations.requestForm.sending') : t('pages.vacations.requestForm.send')}
      </button>
    </div>
  );
};

export default memo(VacationRequestForm);
