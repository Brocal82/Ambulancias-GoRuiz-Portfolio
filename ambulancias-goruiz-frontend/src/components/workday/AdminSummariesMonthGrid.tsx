import React from "react";

type DayCell = {
  date: Date | null;        // null para celdas vacías al inicio
  iso: string | null;       // 'YYYY-MM-DD' si hay fecha
};

type SummariesByDate = Record<string, { total: number; unread: number }>;

interface Props {
  /** Mapa YYYY-MM-DD -> { total, unread } */
  summariesByDate: SummariesByDate;
  /** Fecha seleccionada en formato 'YYYY-MM-DD' */
  selectedDate?: string | null;
  /** Locale para nombres de días (p.ej. 'es-ES', 'de-DE', 'en-US') */
  locale?: string;
  /** Fecha de vista: mes a mostrar (primer día del mes) */
  viewDate: Date;
  /** Click en un día del mes actual mostrado */
  onSelectDate?: (isoDate: string) => void;
  /** Navegación */
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
}

/** Util: YYYY-MM-DD */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Crea las celdas del mes indicado (con huecos iniciales) */
function buildMonthGrid(ref: Date, weekStartsOn: 0 | 1 = 1): DayCell[] {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

  // offset para empezar lunes (1) o domingo (0)
  const firstWeekday = first.getDay(); // 0..6 (0 es domingo)
  const offset = weekStartsOn === 1
    ? (firstWeekday === 0 ? 6 : firstWeekday - 1)
    : firstWeekday;

  const cells: DayCell[] = [];
  for (let i = 0; i < offset; i++) cells.push({ date: null, iso: null });
  for (let d = 1; d <= last.getDate(); d++) {
    const cur = new Date(ref.getFullYear(), ref.getMonth(), d);
    cells.push({ date: cur, iso: toISODate(cur) });
  }
  return cells;
}

const weekdayHeaders = (locale: string, weekStartsOn: 0 | 1 = 1) => {
  // semana ficticia 2021-08-01 (domingo)
  const base = new Date(2021, 7, 1);
  const list: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    list.push(d.toLocaleDateString(locale, { weekday: "short" }));
  }
  if (weekStartsOn === 1) {
    const [sun, ...rest] = list;
    return [...rest, sun];
  }
  return list;
};

const AdminSummariesMonthGrid: React.FC<Props> = ({
  summariesByDate,
  selectedDate = null,
  locale = "es-ES",
  viewDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}) => {
  const monthRef = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const cells = buildMonthGrid(monthRef, 1); // lunes
  const weekNames = weekdayHeaders(locale, 1);

  const monthLabel = monthRef.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full">
      {/* Encabezado del mes con navegación */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevMonth}
            className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onToday}
            className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <h3 className="text-lg font-semibold capitalize">{monthLabel}</h3>

        <div className="text-xs text-slate-500 select-none">
          {new Date().toLocaleDateString(locale)}
        </div>
      </div>

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 uppercase tracking-wide">
        {weekNames.map((w, idx) => (
          <div key={idx} className="px-2 py-1 text-center">{w}</div>
        ))}
      </div>

      {/* Celdas del mes */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.date || !cell.iso) {
            return <div key={idx} className="h-16 rounded-md bg-transparent" />;
          }

          const iso = cell.iso as string;
          const isSelected = selectedDate === iso;
          const counts = summariesByDate[iso];
          const total = counts?.total ?? 0;
          const unread = counts?.unread ?? 0;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate?.(iso)}
              className={[
                "relative h-16 rounded-md border text-left p-2 transition",
                isSelected
                  ? "border-orange-100 ring-2 ring-orange-200 bg-orange-50"
                  : "border-slate-200 hover:bg-slate-50",
              ].join(" ")}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${iso} (${total} resúmenes${unread > 0 ? `, ${unread} sin revisar` : ""})`}
            >
              <div className="text-xs font-medium text-slate-700">
                {cell.date.getDate()}
              </div>

              {total > 0 && (
                <div className="absolute bottom-1 right-1 flex items-center gap-1">
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-orange-500 text-white text-[10px] px-1">
                    {total}
                  </span>
                  {unread > 0 && (
                    <span className="inline-block h-5 w-5 rounded-full ring-2 ring-orange-400" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSummariesMonthGrid;
