// frontend/src/components/workday/AdminSummariesMonthGrid.tsx
import React from "react";

type DayCell = {
  date: Date | null; // null para celdas vacías al inicio
  iso: string | null; // 'YYYY-MM-DD' si hay fecha
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
  const offset =
    weekStartsOn === 1
      ? firstWeekday === 0
        ? 6
        : firstWeekday - 1
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

  const todayISO = toISODate(new Date());

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      {/* Encabezado del mes con navegación */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onToday}
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <h3 className="text-lg font-semibold capitalize text-slate-800">
          {monthLabel}
        </h3>

        <div className="hidden text-xs text-slate-500 select-none sm:block">
          {new Date().toLocaleDateString(locale)}
        </div>
      </div>

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 uppercase tracking-wide">
        {weekNames.map((w, idx) => (
          <div
            key={idx}
            className="px-2 py-1 text-center font-semibold text-slate-500/80"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Celdas del mes */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.date || !cell.iso) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-16 rounded-xl bg-transparent"
              />
            );
          }

          const iso = cell.iso as string;
          const isSelected = selectedDate === iso;
          const isToday = iso === todayISO;

          const counts = summariesByDate[iso];
          const total = counts?.total ?? 0;
          const unread = counts?.unread ?? 0;

          const baseClasses =
            "relative flex h-16 flex-col rounded-xl border bg-white p-2 text-left text-xs transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:shadow-sm";

          // ✅ estilo coherente con messages grid:
          // - selected: azul un pelín más oscuro
          // - unread: ámbar con ring suave
          // - today: borde azul suave (sin badge)
          const stateClasses = isSelected
            ? "border-blue-600 ring-2 ring-blue-200 bg-blue-50"
            : unread > 0
              ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50/60"
              : isToday
                ? "border-blue-300 bg-white"
                : "border-slate-200";

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate?.(iso)}
              className={`${baseClasses} ${stateClasses}`}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${iso} (${total} resúmenes${unread > 0 ? `, ${unread} sin revisar` : ""
                })`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Resúmenes del día */}
              {total > 0 && (
                <div className="mt-auto flex items-center justify-between text-[10px]">
                  {/* ✅ contador más suave (no negro agresivo) */}
                  <span className="inline-flex items-center justify-center min-w-[1.6rem] rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 px-1 py-[2px] border border-slate-200">
                    {total}
                  </span>

                  {unread > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm" />
                      {unread}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ✅ Leyenda eliminada (igual que en messages grid) */}
    </div>
  );
};

export default AdminSummariesMonthGrid;
