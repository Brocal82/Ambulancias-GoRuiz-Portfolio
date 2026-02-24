import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "../../../types/appointment";
import { getYearMonths } from "../utils";
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../components/common/StatusBadge";

type MonthCounts = {
  total: number;
  pending: number; // pending + proposed
};

type CountsByMonth = Record<number, MonthCounts>; // 0..11

type Props = {
  /** Citas del año (pueden venir de varias fuentes; confirmadas, pendientes, etc.) */
  items: Appointment[];

  /** Año inicial a mostrar (por defecto, el año actual). */
  year?: number;

  /** Callback cuando se hace clic en un mes (0..11). */
  onMonthClick?: (monthIndex: number) => void;

  /** Resaltar mes actual con borde */
  highlightCurrentMonth?: boolean;

  /** Mes seleccionado (0..11) para pintar borde azul */
  selectedMonth?: number | null;


  /** índice del mes actual (0–11) */
  currentMonthIndex?: number;
};

function getAppointmentDateForMonthKey(a: Appointment): Date | null {
  // Preferimos selectedSlot.start si existe (citas de calendario).
  // Si no, caemos a createdAt/updatedAt para que pending/proposed también cuenten en algún mes.
  const anyA = a as any;

  const start =
    anyA?.selectedSlot?.start ??
    anyA?.selectedSlotStart ??
    anyA?.createdAt ??
    anyA?.updatedAt;

  if (!start) return null;

  const d = start instanceof Date ? start : new Date(start);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildCountsByMonth(items: Appointment[], year: number): CountsByMonth {
  const out: CountsByMonth = {} as CountsByMonth;

  for (let m = 0; m < 12; m++) {
    out[m] = { total: 0, pending: 0 };
  }

  for (const a of items) {
    const d = getAppointmentDateForMonthKey(a);
    if (!d) continue;

    if (d.getFullYear() !== year) continue;

    const m = d.getMonth();
    out[m].total += 1;

    const status = (a as any)?.status as string | undefined;
    if (status === "pending" || status === "proposed") {
      out[m].pending += 1;
    }
  }

  return out;
}

const AdminAppointmentMonthGrid: React.FC<Props> = ({
  items,
  year = new Date().getFullYear(),
  selectedMonth = null,
  onMonthClick,
  highlightCurrentMonth = false,
  currentMonthIndex,
}) => {
  const { t, i18n } = useTranslation();

  // ✅ Año navegable (permitimos futuro en citas)
  const [viewYear, setViewYear] = useState<number>(year);

  // si el parent cambia year, sincronizamos
  useEffect(() => {
    setViewYear(year);
  }, [year]);

  const months = useMemo(() => getYearMonths(viewYear, i18n.language), [viewYear, i18n.language]);

  const countsByMonth = useMemo(() => {
    return buildCountsByMonth(items, viewYear);
  }, [items, viewYear]);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = currentMonthIndex ?? now.getMonth();

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      {/* Header año + navegación (igual que mensajes) */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition"
            aria-label={t("common.prevYear", "Año anterior")}
          >
            ‹
          </button>

          {/* Botón año actual (muestra el número, no “este año”) */}
          <button
            type="button"
            onClick={() => setViewYear(thisYear)}
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition"
            aria-label={t("common.thisYear", "Ir al año actual")}
            title={t("common.thisYear", "Ir al año actual")}
          >
            {thisYear}
          </button>

          {/* ✅ aquí SÍ permitimos ir al futuro */}
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 text-lg hover:bg-slate-50 active:scale-95 transition"
            aria-label={t("common.nextYear", "Año siguiente")}
          >
            ›
          </button>
        </div>

        <h3 className="text-lg font-semibold text-slate-800">{viewYear}</h3>

        <div className="hidden text-xs text-slate-500 select-none sm:block">
          {new Date().toLocaleDateString(i18n.language)}
        </div>
      </div>

      {/* Grid 12 meses */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {months.map(({ monthIndex, label }) => {
          const c = countsByMonth[monthIndex] ?? { total: 0, pending: 0 };
          const total = c.total ?? 0;
          const pending = c.pending ?? 0;

          const hasItems = total > 0;
          const hasPending = pending > 0;

          const isCurrent =
            highlightCurrentMonth && viewYear === thisYear && monthIndex === thisMonth;

          const isSelected = selectedMonth === monthIndex;

          const baseClasses =
            "relative flex min-h-[72px] flex-col rounded-xl border bg-white p-3 text-left text-xs transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:shadow-sm";

          // ✅ Estilo calcado a mensajes:
          // - pending (ábar) prioriza
          // - current (borde azul clarito)
          // - neutro
          const stateClasses = isSelected
            ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
            : hasPending
              ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50/60"
              : isCurrent
                ? "border-blue-300 bg-blue-50/40"
                : "border-slate-200";


          return (
            <button
              key={monthIndex}
              type="button"
              onClick={() => onMonthClick?.(monthIndex)}
              aria-label={t("pages.appointments.monthGrid.ariaOpenMonth", {
                label,
                year: viewYear,
              })}
              className={`${baseClasses} ${stateClasses}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold capitalize text-slate-800">
                  {label}
                </span>
              </div>

              {/* Badges suaves: solo si hay datos */}
              {(hasItems || hasPending) && (
                <div className="mt-auto flex items-center justify-between text-[10px]">
                  {hasItems ? (
                    <StatusBadge
                      tone="slate"
                      label={String(total)}
                      className="text-[10px] font-semibold px-2 py-[2px] min-w-[1.6rem] justify-center"
                    />

                  ) : (
                    <span />
                  )}

                  {hasPending && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm" />
                      {pending}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* (sin leyenda, como pediste) */}
      <div className="mt-2" />
    </div>
  );
};

export default AdminAppointmentMonthGrid;
