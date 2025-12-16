import React from "react";
import type { MonthInfo } from "../../utils/vacationMonthUtils";

type Props = {
  year: number;
  months: MonthInfo[]; // getYearMonths(...)
  monthlyCounts: number[]; // longitud 12
  selectedMonthIndex: number | null;
  onSelect: (index: number | null) => void;
  locale?: string;

  // Las siguientes props pueden seguir viniendo desde el padre, pero aquí no se usan.
  clearLabel?: string;
  showingLabel?: string;
  countLabel?: (n: number) => string;
  compact?: boolean;

  // ✅ NUEVO: para colorear borde por mes
  monthBorderClass?: (monthIndex: number) => string;
};

const AdminSickMonthGrid: React.FC<Props> = ({
  year,
  months,
  monthlyCounts,
  selectedMonthIndex,
  onSelect,
  locale = "es",
  countLabel = (n: number) => `${n} baja${n === 1 ? "" : "s"}`,
  compact = true,
  monthBorderClass,
}) => {
  // ✅ IMPORTANTE: quitamos ring/bg del grid para evitar “doble borde”
  const wrapperClass = compact ? "mb-4 p-0" : "mb-4 p-0";

  return (
    <div className={wrapperClass}>
      <div className="mb-2 text-sm text-slate-500">{year}</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {months.map((m, i) => {
          const selected = selectedMonthIndex === i;
          const count = monthlyCounts[i] ?? 0;
          const short = new Intl.DateTimeFormat(locale, {
            month: "short",
          }).format(m.start);

          // ✅ borde dinámico (si el mes tiene bajas/pending/etc)
          const borderDynamic = monthBorderClass ? monthBorderClass(i) : "";

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(selected ? null : i)}
              className={[
                "relative rounded-xl border transition text-left bg-white",
                "focus:outline-none focus:ring-2 focus:ring-offset-0 sm:focus:ring-offset-2",
                selected
                  ? "border-blue-500 ring-1 ring-blue-300 bg-blue-50"
                  : "border-slate-200 hover:shadow-sm",
                compact ? "px-3 py-2" : "p-4",
                // ✅ aplicar borde/ring del mes solo cuando NO está seleccionado
                !selected ? borderDynamic : "",
              ].join(" ")}
              aria-pressed={selected}
            >
              <div className="font-medium text-slate-900">
                <span className="sm:hidden capitalize">{short}</span>
                <span className="hidden sm:inline capitalize">{m.label}</span>
              </div>

              <div className="mt-1 sm:mt-2">
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-medium border",
                    count > 0
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200",
                  ].join(" ")}
                >
                  {countLabel(count)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSickMonthGrid;
