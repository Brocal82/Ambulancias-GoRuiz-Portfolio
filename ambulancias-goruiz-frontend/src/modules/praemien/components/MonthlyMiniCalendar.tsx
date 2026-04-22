//src/modules/praemien/components/MonthlyMiniCalendar.tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MonthlyPraemienDay } from "../domain/api";

export type ViewMonth = { year: number; month: number };

type MonthNavProps = {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  prevLabel: string;
  nextLabel: string;
};

type InteractiveProps = {
  selectedKey: string | null;
  onSelect: (dateKey: string) => void;
  isDisabled: (dateKey: string) => boolean;
  /** Añade clases al número mostrado (p. ej. color por estado en modo manual) */
  valueClassName?: (dateKey: string) => string | undefined;
  /** Fondo suave por día (p. ej. tono según Dienst asignado) */
  dayBaseClassName?: (dateKey: string) => string | undefined;
};

type Props = {
  days: MonthlyPraemienDay[];
  /** Fija el mes mostrado (1–12) sin depender del primer elemento de `days`. */
  viewMonth?: ViewMonth;
  titleKey?: string;
  monthNav?: MonthNavProps;
  /**
   * Tinte por Dienst en días con asignación. Si hay `interactive`, puede omitirse
   * y usar `interactive.dayBaseClassName`; si no, colorea el resumen automático.
   */
  dayBaseClassName?: (dateKey: string) => string | undefined;
  /** Misma rejilla, celdas clicables (entradas manuales). */
  interactive?: InteractiveProps;
};

// Lunes -> Domingo
const WEEKDAY_KEYS_MON = [1, 2, 3, 4, 5, 6, 0] as const;

function normalizeDateKey(dateStr: string): string {
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/** Lunes de la semana calendario (l–d) que contiene `d`. */
function startOfIsoWeekContaining(d: Date): Date {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - mondayIndex(t.getDay()));
  return t;
}

/** Domingo de la misma semana que `d` (lunes–domingo). */
function endOfIsoWeekContaining(d: Date): Date {
  const start = startOfIsoWeekContaining(d);
  const t = new Date(start);
  t.setDate(start.getDate() + 6);
  return t;
}

type Cell = {
  type: "day";
  key: string;
  dayNumber: number;
  value?: number;
  /** Días relleno del mes ant./sig. para completar filas; tono más apagado y no clicable en interactivo. */
  inCurrentMonth: boolean;
};

export default function MonthlyMiniCalendar({
  days,
  viewMonth: viewMonthProp,
  titleKey = "pages.praemien.page.dailyHistoryTitle",
  monthNav,
  dayBaseClassName: dayBaseClassNameProp,
  interactive,
}: Props) {
  const { i18n, t } = useTranslation();

  const { monthTitle, cells } = useMemo(() => {
    let year: number;
    let month0: number;

    if (viewMonthProp) {
      year = viewMonthProp.year;
      month0 = viewMonthProp.month - 1;
    } else if (!days || days.length === 0) {
      const now = new Date();
      year = now.getFullYear();
      month0 = now.getMonth();
    } else {
      const firstKey = normalizeDateKey(days[0].date);
      const ref = new Date(firstKey);
      year = ref.getFullYear();
      month0 = ref.getMonth();
    }

    const monthFormatter = new Intl.DateTimeFormat(i18n.language || undefined, {
      month: "long",
    });
    const yearFormatter = new Intl.DateTimeFormat(i18n.language || undefined, {
      year: "numeric",
    });

    const monthTitleLocal = `${monthFormatter.format(
      new Date(year, month0, 1),
    )} ${yearFormatter.format(new Date(year, month0, 1))}`;

    const map = new Map<string, number>();
    for (const d of days) {
      map.set(normalizeDateKey(d.date), d.totalCountedPatients);
    }

    const totalDays = daysInMonth(year, month0);
    const firstOfMonth = new Date(year, month0, 1);
    const lastOfMonth = new Date(year, month0, totalDays);
    const gridStart = startOfIsoWeekContaining(firstOfMonth);
    const gridEnd = endOfIsoWeekContaining(lastOfMonth);

    const result: Cell[] = [];
    const cur = new Date(gridStart);
    cur.setHours(0, 0, 0, 0);
    const endMs = new Date(gridEnd);
    endMs.setHours(0, 0, 0, 0);

    while (cur.getTime() <= endMs.getTime()) {
      const y = cur.getFullYear();
      const m0 = cur.getMonth();
      const d = cur.getDate();
      const inCurrentMonth = m0 === month0 && y === year;
      const monthStr = String(m0 + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const key = `${y}-${monthStr}-${dayStr}`;
      const value = map.get(key);

      result.push({
        type: "day",
        key,
        dayNumber: d,
        value,
        inCurrentMonth,
      });
      cur.setDate(cur.getDate() + 1);
    }

    return { monthTitle: monthTitleLocal, cells: result };
  }, [days, i18n.language, viewMonthProp]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language || undefined, {
      weekday: "short",
    });
    const base = new Date(2025, 0, 6);
    return WEEKDAY_KEYS_MON.map((_, idx) => {
      const d = new Date(base);
      d.setDate(base.getDate() + idx);
      return fmt.format(d);
    });
  }, [i18n.language]);

  const title = t(titleKey);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {monthNav ? (
          <div className="flex items-center justify-end gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={!monthNav.canPrev}
              onClick={monthNav.onPrev}
              className="rounded-lg border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700 disabled:opacity-40"
            >
              {monthNav.prevLabel}
            </button>
            <span className="min-w-0 text-xs text-slate-500 tabular-nums capitalize">
              {monthTitle || "—"}
            </span>
            <button
              type="button"
              disabled={!monthNav.canNext}
              onClick={monthNav.onNext}
              className="rounded-lg border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700 disabled:opacity-40"
            >
              {monthNav.nextLabel}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-500 tabular-nums capitalize">
            {monthTitle || "—"}
          </span>
        )}
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-600">
        {weekdayLabels.map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isAdjacentMonth = !cell.inCurrentMonth;
          const hasValue = typeof cell.value === "number";
          const valueToShow = hasValue ? cell.value : undefined;
          const disabled = interactive
            ? isAdjacentMonth || interactive.isDisabled(cell.key)
            : false;
          const selected = interactive
            ? cell.inCurrentMonth &&
              interactive.selectedKey === cell.key
            : false;
          const valueExtraClass = interactive?.valueClassName?.(cell.key) ?? "";
          const dienstBg =
            (interactive?.dayBaseClassName?.(cell.key) ??
              dayBaseClassNameProp?.(cell.key)) ??
            "";
          const hasDienstBg = Boolean(dienstBg);

          const adjacentRingClass = isAdjacentMonth
            ? " ring-slate-200/80"
            : "";

          let surfaceClass: string;
          if (!interactive) {
            if (hasDienstBg) {
              surfaceClass = [
                "h-9 rounded-lg ring-1 relative px-1",
                adjacentRingClass || " ring-slate-200",
                dienstBg,
                isAdjacentMonth ? " opacity-[0.88]" : "",
              ].join(" ");
            } else {
              surfaceClass = [
                "h-9 rounded-lg ring-1 relative px-1",
                isAdjacentMonth
                  ? "bg-slate-50/90 ring-slate-200/80"
                  : valueToShow == null
                    ? "bg-white ring-slate-200"
                    : "bg-blue-50 ring-slate-200",
              ].join(" ");
            }
          } else if (disabled) {
            surfaceClass = [
              "h-9 rounded-lg ring-1 relative px-1",
              isAdjacentMonth
                ? "ring-slate-100/80 opacity-60"
                : "ring-slate-100 opacity-50",
              hasDienstBg ? dienstBg : "bg-slate-50",
            ].join(" ");
          } else if (selected) {
            surfaceClass = [
              "h-9 rounded-lg ring-2 relative px-1 ring-orange-400",
              hasDienstBg ? dienstBg : "bg-orange-50/50",
            ].join(" ");
          } else {
            const defaultBg = hasDienstBg
              ? dienstBg
              : valueToShow == null
                ? "bg-white"
                : "bg-blue-50";
            surfaceClass = [
              "h-9 rounded-lg ring-1 relative px-1 ring-slate-200",
              defaultBg,
              isAdjacentMonth && hasDienstBg ? " opacity-[0.9]" : "",
              "hover:ring-slate-300",
            ].join(" ");
          }

          const inner = (
            <>
              <div
                className={
                  "absolute top-1 left-1 text-[9px] tabular-nums " +
                  (isAdjacentMonth
                    ? "text-slate-400"
                    : "text-slate-500")
                }
              >
                {cell.dayNumber}
              </div>
              <div className="flex h-full items-center justify-center">
                {valueToShow == null ? null : (
                  <span
                    className={[
                      "text-[12px] font-semibold tabular-nums",
                      valueExtraClass || "text-slate-900",
                    ].join(" ")}
                  >
                    {valueToShow}
                  </span>
                )}
              </div>
            </>
          );

          if (interactive && !disabled) {
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => interactive.onSelect(cell.key)}
                className={surfaceClass + " w-full p-0 text-left"}
              >
                {inner}
              </button>
            );
          }

          if (interactive && disabled) {
            return (
              <div
                key={cell.key}
                className={surfaceClass + " flex cursor-not-allowed flex-col justify-center"}
              >
                {inner}
              </div>
            );
          }

          return (
            <div key={cell.key} className={surfaceClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
