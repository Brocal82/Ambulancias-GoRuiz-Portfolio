// src/components/vacation/AlternativeDateModal.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { startOfDay } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useTranslation } from 'react-i18next';
import { es as dfEs, de as dfDe, enGB as dfEnGB } from 'date-fns/locale';
import {
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from '../../api/vacation';

interface AlternativeDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (startDate: string, endDate: string, adminNote: string) => void;
  initialStartDate: Date;
  initialEndDate: Date;
}

const AlternativeDateModal: React.FC<AlternativeDateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialStartDate,
  initialEndDate,
}) => {
  const { t, i18n } = useTranslation();

  // Locale: semana empieza en LUNES (igual que en el form del trabajador)
  const pickerLocale = useMemo(
    () => (i18n.language.startsWith('de') ? dfDe : i18n.language.startsWith('es') ? dfEs : dfEnGB),
    [i18n.language]
  );

  // Rango seleccionado (controlado), arranca con las fechas del trabajador
  const [selectionRange, setSelectionRange] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate,
    key: 'selection' as const,
  });

  const [adminNote, setAdminNote] = useState('');

  // Días bloqueados (rojos) y caché por mes — igual que en VacationRequestForm
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [redDaysByMonth, setRedDaysByMonth] = useState<Record<string, number[]>>({});

  // Evitar peticiones duplicadas por mes
  const inflightRef = useRef<Record<string, Promise<void> | undefined>>({});
  const monthKey = (y: number, m1: number) => `${y}-${String(m1).padStart(2, '0')}`;

  // Helpers para comparar arrays (evitar renders)
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

  // Cargar disponibilidad de un mes (sin duplicados/carreras)
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

  // Construir disabledDates a partir del mapa de días rojos
  useEffect(() => {
    const dates: Date[] = [];
    Object.entries(redDaysByMonth).forEach(([k, dayNums]) => {
      const [y, m] = k.split('-').map(Number);
      for (const d of dayNums) dates.push(new Date(y, m - 1, d, 0, 0, 0, 0));
    });
    setDisabledDates(prev => (sameDateArray(prev, dates) ? prev : dates));
  }, [redDaysByMonth]);

  // Sincroniza rango cuando cambian las fechas iniciales (abrir modal o reabrir con otras fechas)
  useEffect(() => {
    setSelectionRange(prev => ({
      ...prev,
      startDate: initialStartDate,
      endDate: initialEndDate,
    }));
  }, [initialStartDate, initialEndDate]);

  // Carga inicial: mes de start y el siguiente (igual que en el form)
  useEffect(() => {
    if (!isOpen) return;
    const base = initialStartDate ?? new Date();
    const y = base.getFullYear();
    const m1 = base.getMonth() + 1;
    const next = m1 === 12 ? { year: y + 1, month: 1 } : { year: y, month: m1 + 1 };
    ensureMonthLoaded(y, m1);
    ensureMonthLoaded(next.year, next.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Manejo de selección (calcado del form del trabajador)
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

      // Precargar meses implicados
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

  // ¿El rango contiene algún día bloqueado?
  const rangeContainsDisabled = (start: Date, end: Date) => {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    for (const d of disabledDates) {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (t >= s && t <= e) return true;
    }
    return false;
  };

  // Asegura que todos los meses del rango están cargados antes de validar/enviar
  const ensureAllMonthsInRangeLoaded = async (start: Date, end: Date) => {
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);

    const jobs: Promise<void>[] = [];
    for (
      let y = s.getFullYear(), m = s.getMonth();
      y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth());
    ) {
      const m1 = m + 1;
      jobs.push(ensureMonthLoaded(y, m1));
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    await Promise.all(jobs);
  };

  const submit = async () => {
    await ensureAllMonthsInRangeLoaded(selectionRange.startDate, selectionRange.endDate);
    if (rangeContainsDisabled(selectionRange.startDate, selectionRange.endDate)) {
      // mismo comportamiento que el form del trabajador: evitamos enviar si hay días rojos
      return;
    }
    onSubmit(
      selectionRange.startDate.toISOString(),
      selectionRange.endDate.toISOString(),
      adminNote
    );
    onClose();
    setAdminNote('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t('pages.vacations.altModal.title')}
        </h3>

        {/* Estilo local idéntico al del formulario */}
        <style>{`
          .vacation-range .rdrDateRangeWrapper,
          .vacation-range .rdrCalendarWrapper,
          .vacation-range .rdrMonths,
          .vacation-range .rdrMonth { width: 100%; }
        `}</style>

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
            preventSnapRefocus
            calendarFocus="forwards"
            fixedHeight
          />
        </div>

        <textarea
          placeholder={t('pages.vacations.altModal.notePlaceholder')}
          className="mt-4 w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 p-2 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-100"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={() => {
              onClose();
              setAdminNote('');
            }}
          >
            {t('pages.vacations.altModal.cancel')}
          </button>
          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            onClick={submit}
          >
            {t('pages.vacations.altModal.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlternativeDateModal;
