import { useEffect, useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { addDays, startOfDay } from 'date-fns';
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

const VacationRequestForm = ({ onSuccess }: VacationRequestFormProps) => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const pickerLocale =
    i18n.language.startsWith('de') ? dfDe :
    i18n.language.startsWith('es') ? dfEs :
    dfEnGB; // en-GB empieza en lunes

  // Rango seleccionado (controlado)
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: addDays(new Date(), 3),
    key: 'selection' as const,
  });

  // Estado UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Días bloqueados = NO seleccionables en el calendario
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  // Cache de meses ya cargados y mapa de días rojos por mes
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [redDaysByMonth, setRedDaysByMonth] = useState<Record<string, number[]>>({});

  const monthKey = (y: number, m1: number) => `${y}-${String(m1).padStart(2, '0')}`;

  // Carga disponibilidad para un mes (añade días rojos)
  async function ensureMonthLoaded(y: number, m1: number) {
    const key = monthKey(y, m1);
    if (loadedMonths[key]) return;

    try {
      const data: VacationAvailabilityResponse = await getVacationAvailability({ year: y, month: m1 });
      const redDays = data.days.filter(d => d.state === 'red').map(d => d.day);
      setRedDaysByMonth(prev => ({ ...prev, [key]: redDays }));
      setLoadedMonths(prev => ({ ...prev, [key]: true }));
    } catch {
      // marcar como cargado para no reintentar en bucle (si quieres reintentos, elimina esta línea)
      setLoadedMonths(prev => ({ ...prev, [key]: true }));
    }
  }

  // Reconstruye disabledDates cada vez que cambia el mapa de días rojos
  useEffect(() => {
    const dates: Date[] = [];
    Object.entries(redDaysByMonth).forEach(([k, dayNums]) => {
      const [y, m] = k.split('-').map(Number);
      for (const d of dayNums) {
        // construir fecha "pura" a medianoche para evitar TZ raras
        dates.push(new Date(y, m - 1, d, 0, 0, 0, 0));
      }
    });
    setDisabledDates(dates);
  }, [redDaysByMonth]);

  // Carga inicial: mes del startDate actual y el siguiente
  useEffect(() => {
    const base = selectionRange.startDate ?? new Date();
    const y = base.getFullYear();
    const m1 = base.getMonth() + 1;
    const next = m1 === 12 ? { year: y + 1, month: 1 } : { year: y, month: m1 + 1 };
    ensureMonthLoaded(y, m1);
    ensureMonthLoaded(next.year, next.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch al navegar por el calendario (cambio de mes/año)
  const handleShownDateChange = (arg: any) => {
    // defensivo: algunas builds envían { date }, otras el Date directo
    const next: Date =
      arg instanceof Date ? arg :
      arg?.date instanceof Date ? arg.date :
      new Date(arg);

    if (isNaN(next.getTime())) return;

    const y = next.getFullYear();
    const m1 = next.getMonth() + 1;
    const nextM = m1 === 12 ? { year: y + 1, month: 1 } : { year: y, month: m1 + 1 };

    ensureMonthLoaded(y, m1);
    ensureMonthLoaded(nextM.year, nextM.month);
  };

  // ⚠️ MUY IMPORTANTE: ignorar eventos de navegación (onChange sin fechas)
  const handleSelect = (ranges: RangeKeyDict) => {
    const next = ranges.selection;
    const hasStart = next.startDate instanceof Date;
    const hasEnd = next.endDate instanceof Date;

    if (!hasStart && !hasEnd) {
      // Evento de navegación: NO tocar el rango → no se "resetea" a hoy
      return;
    }

    setSelectionRange(prev => ({
      ...prev,
      startDate: hasStart ? (next.startDate as Date) : prev.startDate,
      endDate: hasEnd ? (next.endDate as Date) : prev.endDate,
      key: 'selection',
    }));

    // Prefetch por si el usuario salta con selección a otro mes lejano
    if (hasStart) {
      const y = (next.startDate as Date).getFullYear();
      const m1 = (next.startDate as Date).getMonth() + 1;
      const nm = m1 === 12 ? { year: y + 1, month: 1 } : { year: y, month: m1 + 1 };
      ensureMonthLoaded(y, m1);
      ensureMonthLoaded(nm.year, nm.month);
    }
    if (hasEnd) {
      const y = (next.endDate as Date).getFullYear();
      const m1 = (next.endDate as Date).getMonth() + 1;
      const nm = m1 === 12 ? { year: y + 1, month: 1 } : { year: y, month: m1 + 1 };
      ensureMonthLoaded(y, m1);
      ensureMonthLoaded(nm.year, nm.month);
    }
  };

  // Validación extra al enviar
  function rangeContainsDisabled(start: Date, end: Date) {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    for (const d of disabledDates) {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (t >= s && t <= e) return true;
    }
    return false;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage(t('pages.vacations.requestForm.mustLogin'));
      return;
    }
    if (rangeContainsDisabled(selectionRange.startDate, selectionRange.endDate)) {
      setMessage(t('pages.vacations.requestForm.rangeBlocked', 'El rango contiene días sin disponibilidad.'));
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
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
        .vacation-range .rdrMonths { display: flex; }
        .vacation-range .rdrMonth { flex: 1; }
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
          minDate={startOfDay(new Date())}   // evita problemas de TZ
          maxDate={new Date(2035, 11, 31)}  // permite 2026/2027/…
          disabledDates={disabledDates}     // ← Aquí se bloquean de forma nativa
          onShownDateChange={handleShownDateChange} // prefetch al navegar (si tu build lo expone)
          locale={pickerLocale}              // semana L–D
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

export default VacationRequestForm;
