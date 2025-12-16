import React, { useMemo, useState, useEffect, useCallback } from "react";
import { DateRange } from "react-date-range";
import type { RangeKeyDict } from "react-date-range";
import { es as dfEs, de as dfDe, enGB as dfEnGB } from "date-fns/locale";

// Estilos base del date range (igual que en VacationRequestForm)
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

type Props = {
  /** Strings 'YYYY-MM-DD' (pueden venir vacíos) */
  startDateStr: string;
  endDateStr: string;
  /** Emite fechas en 'YYYY-MM-DD' */
  onChange: (startStr: string, endStr: string) => void;
  /** i18n.language (ej: 'es', 'de', 'en') */
  localeCode?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
};

/** Normaliza string 'YYYY-MM-DD' a Date a las 00:00. Si viene vacío o inválido, usa hoy. */
function parseISODateOrToday(iso: string) {
  if (!iso) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  return date;
}

/** Devuelve 'YYYY-MM-DD' desde Date (TZ local) */
function toISODateString(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SickLeaveRequestForm: React.FC<Props> = ({
  startDateStr,
  endDateStr,
  onChange,
  localeCode = "es",
  minDate,
  maxDate = new Date(2035, 11, 31),
  className,
}) => {
  // Locale: lunes como primer día de semana (coherente con VacationRequestForm)
  const pickerLocale = useMemo(() => {
    if (localeCode.startsWith("de")) return dfDe;
    if (localeCode.startsWith("es")) return dfEs;
    return dfEnGB;
  }, [localeCode]);

  // Estado interno requerido por react-date-range (usa Date)
  const [selection, setSelection] = useState(() => ({
    startDate: parseISODateOrToday(startDateStr),
    endDate: parseISODateOrToday(endDateStr || startDateStr),
    key: "selection" as const,
  }));

  // ✅ Sincroniza desde props SOLO si cambian de verdad (evita "volver a hoy")
  useEffect(() => {
    const nextStart = parseISODateOrToday(startDateStr);
    const nextEnd = parseISODateOrToday(endDateStr || startDateStr);

    const curStartISO = toISODateString(selection.startDate);
    const curEndISO = toISODateString(selection.endDate);
    const nextStartISO = toISODateString(nextStart);
    const nextEndISO = toISODateString(nextEnd);

    if (curStartISO === nextStartISO && curEndISO === nextEndISO) return;

    setSelection((prev) => ({
      ...prev,
      startDate: nextStart,
      endDate: nextEnd,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateStr, endDateStr]);

  // ✅ Ignora navegación pura (cuando onChange no trae fechas); no muta objetos Date del picker
  const handleSelect = useCallback(
    (ranges: RangeKeyDict) => {
      const next = ranges.selection;

      const hasStart = next.startDate instanceof Date;
      const hasEnd = next.endDate instanceof Date;

      // Navegación (cambiar mes) => no tocar estado
      if (!hasStart && !hasEnd) return;

      const start = hasStart
        ? new Date(next.startDate as Date)
        : new Date(selection.startDate);
      const end = hasEnd
        ? new Date(next.endDate as Date)
        : hasStart
          ? new Date(next.startDate as Date)
          : new Date(selection.endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const startISO = toISODateString(start);
      const endISO = toISODateString(end);
      const curStartISO = toISODateString(selection.startDate);
      const curEndISO = toISODateString(selection.endDate);

      // Si no hay cambio real, no re-renderices
      if (startISO === curStartISO && endISO === curEndISO) return;

      setSelection({
        startDate: start,
        endDate: end,
        key: "selection",
      });

      // Emite al padre (tu WorkerSickLeavesPage sigue igual)
      onChange(startISO, endISO);
    },
    [onChange, selection.startDate, selection.endDate],
  );

  return (
    <div
      className={["vacation-range w-full", className].filter(Boolean).join(" ")}
    >
      {/* Mismo ajuste de ancho que en Vacation */}
      <style>{`
      .vacation-range .rdrDateRangeWrapper,
      .vacation-range .rdrCalendarWrapper,
      .vacation-range .rdrMonths,
      .vacation-range .rdrMonth { width: 100%; }
    `}</style>

      {/* SOLO el calendario, sin h2 ni tarjeta blanca */}
      <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden w-full">
        <DateRange
          className="w-full"
          ranges={[selection]}
          onChange={handleSelect}
          moveRangeOnFirstSelection={false}
          minDate={minDate}
          maxDate={maxDate}
          locale={pickerLocale}
          preventSnapRefocus
          calendarFocus="forwards"
          fixedHeight
        />
      </div>
    </div>
  );
};

export default SickLeaveRequestForm;
