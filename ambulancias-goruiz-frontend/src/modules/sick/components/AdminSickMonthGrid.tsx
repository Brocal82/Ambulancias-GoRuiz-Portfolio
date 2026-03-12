// frontend/src/components/sick/AdminSickMonthGrid.tsx
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MonthInfo } from "../../../utils/vacationMonthUtils";

type Props = {
  year: number;
  months: MonthInfo[]; // getYearMonths(...)
  monthlyCounts: number[]; // longitud 12
  selectedMonthIndex: number | null;
  onSelect: (index: number | null) => void;
  locale?: string;

  // Mantengo estas props aunque no se usen (como ya tenías)
  clearLabel?: string;
  showingLabel?: string;
  countLabel?: (n: number) => string;

  /** Navegación de año (controlada por el padre) */
  onPrevYear?: () => void;
  onNextYear?: () => void;
  onThisYear?: () => void;

  /** Opcional: para deshabilitar ir al futuro */
  disableNextYear?: boolean;

  // ✅ para colorear borde por mes (p.ej. pending/accepted/rejected)
  monthBorderClass?: (monthIndex: number) => string;
};

const AdminSickMonthGrid: React.FC<Props> = ({
  year,
  months,
  monthlyCounts,
  selectedMonthIndex,
  onSelect,
  locale = "es-ES",
  countLabel = (n: number) => `${n} baja${n === 1 ? "" : "s"}`,
  monthBorderClass,

  // ✅ IMPORTANTE: destructuring de navegación
  onPrevYear,
  onNextYear,
  onThisYear,
  disableNextYear = false,
}) => {
  const { t } = useTranslation();

  const now = useMemo(() => new Date(), []);
  const thisYear = now.getFullYear();

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      {/* Header año + navegación (igual que mensajes) */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevYear}
            disabled={!onPrevYear}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t("common.prevYear", "Año anterior")}
          >
            ‹
          </button>

          {/* Botón año actual (muestra el número) */}
          <button
            type="button"
            onClick={onThisYear}
            disabled={!onThisYear}
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t("common.thisYear", "Ir al año actual")}
            title={t("common.thisYear", "Ir al año actual")}
          >
            {thisYear}
          </button>

          <button
            type="button"
            onClick={onNextYear}
            disabled={!onNextYear || disableNextYear}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t("common.nextYear", "Año siguiente")}
          >
            ›
          </button>
        </div>

        <h3 className="text-lg font-semibold text-slate-800">{year}</h3>

        <div className="hidden text-xs text-slate-500 select-none sm:block">
          {new Date().toLocaleDateString(locale)}
        </div>
      </div>

      {/* Grid 12 meses (igual que mensajes) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {months.map((m, i) => {
          const isSelected = selectedMonthIndex === i;
          const count = monthlyCounts[i] ?? 0;
          const hasItems = count > 0;

          const dynamic = monthBorderClass ? monthBorderClass(i) : "";

          const label = m.label;
          const short = new Intl.DateTimeFormat(locale, { month: "short" }).format(
            m.start,
          );

          const baseClasses =
            "relative flex min-h-[72px] flex-col rounded-xl border bg-white p-3 text-left text-xs transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:shadow-sm";

          const stateClasses = isSelected
            ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
            : dynamic
              ? dynamic
              : "border-slate-200";

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(isSelected ? null : i)}
              className={`${baseClasses} ${stateClasses}`}
              aria-pressed={isSelected}
              aria-label={`${label} ${year} (${countLabel(count)})`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold capitalize text-slate-800">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </div>

              {/* Badge suave: solo si hay bajas */}
              {hasItems && (
                <div className="mt-auto flex items-center justify-between text-[10px]">
                  <span className="inline-flex items-center justify-center min-w-[1.6rem] rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 px-2 py-[2px] ring-1 ring-slate-200">
                    {count}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSickMonthGrid;

