// frontend/src/components/vacation/AdminVacationMonthGrid.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { IVacationRequest } from "../domain/types";
import { getYearMonths } from "../../../utils/calendarMonthUtils";
import { countRequestsByMonth } from "../utils/vacationMonthUtils";
import { useVacationAvailabilityInvalidation } from "../hooks/useVacationAvailabilityInvalidation";
import { useTranslation } from "react-i18next";

// API disponibilidad
import {
  getVacationAvailability,
  type VacationAvailabilityResponse,
} from "../domain/api";
import {
  vacationMonthBorderPriority,
  vacationRequestBorderClass,
} from "../utils/vacationRequestBorder";


type Props = {
  requests: IVacationRequest[];
  year?: number;
  onMonthClick?: (monthIndex: number) => void; // compatibilidad
  // NUEVOS opcionales:
  onYearChange?: (year: number) => void;
  onMonthOpen?: (monthIndex: number, year: number) => void;
};

type MonthAvailabilitySummary = {
  green: number;
  yellow: number;
  red: number;
  maxPerDay: number;
  loaded: boolean;
  error?: string;
};

const AdminVacationMonthGrid: React.FC<Props> = ({
  requests,
  year = new Date().getFullYear(),
  onYearChange,
  onMonthOpen,
  onMonthClick,
}) => {
  const { t, i18n } = useTranslation();

  // ---- Año local con controles ----
  const [localYear, setLocalYear] = useState<number>(year);
  useEffect(() => {
    setLocalYear(year); // si desde fuera te cambian 'year', sincroniza
  }, [year]);

  const handleYearDelta = (delta: number) => {
    const next = localYear + delta;
    setLocalYear(next);
    onYearChange?.(next);
  };

  const months = getYearMonths(localYear, i18n.language);
  const counts = countRequestsByMonth(requests, localYear);

  // Disponibilidad por mes (resumen)
  const [availabilityByMonth, setAvailabilityByMonth] = useState<
    Record<number, MonthAvailabilitySummary>
  >({});

  const initialSummary: MonthAvailabilitySummary = useMemo(
    () => ({ green: 0, yellow: 0, red: 0, maxPerDay: 0, loaded: false }),
    [],
  );

  // ===== Helpers internos =====
  const buildSummary = (
    data: VacationAvailabilityResponse,
  ): MonthAvailabilitySummary => {
    const summaryCounts = data.days.reduce(
      (acc, d) => {
        if (d.state === "green") acc.green += 1;
        else if (d.state === "yellow") acc.yellow += 1;
        else acc.red += 1;
        return acc;
      },
      { green: 0, yellow: 0, red: 0 },
    );
    return { ...summaryCounts, maxPerDay: data.maxPerDay, loaded: true };
  };

  const refreshTimerRef = useRef<Record<number, number>>({}); // por mes (m0) → timeoutId

  const refreshMonth = async (y: number, m0: number, force = false) => {
    // Solo refrescar si el evento es del año visible
    if (y !== localYear) return;

    const m1 = m0 + 1;
    try {
      const data = await getVacationAvailability(
        { year: y, month: m1 },
        { force },
      );
      setAvailabilityByMonth((prev) => ({
        ...prev,
        [m0]: buildSummary(data),
      }));
    } catch {
      setAvailabilityByMonth((prev) => ({
        ...prev,
        [m0]: { ...initialSummary, loaded: true, error: "load_error" },
      }));
    }
  };

  const scheduleRefreshMonth = (y: number, m1: number) => {
    if (y !== localYear) return;
    const m0 = m1 - 1;

    // micro-retardo para evitar carrera con el commit del backend (200ms)
    const existing = refreshTimerRef.current[m0];
    if (existing) {
      window.clearTimeout(existing);
    }
    refreshTimerRef.current[m0] = window.setTimeout(() => {
      refreshMonth(y, m0, true);
      // limpiar referencia
      delete refreshTimerRef.current[m0];
    }, 200);
  };

  // Carga inicial de TODOS los meses del año visible
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const promises = months.map(async ({ monthIndex }) => {
          const month1to12 = monthIndex + 1;
          const data: VacationAvailabilityResponse =
            await getVacationAvailability({
              year: localYear,
              month: month1to12,
            });
          return { monthIndex, summary: buildSummary(data) };
        });

        const results = await Promise.allSettled(promises);
        if (cancelled) return;

        const next: Record<number, MonthAvailabilitySummary> = {};
        for (const r of results) {
          if (r.status === "fulfilled") {
            next[r.value.monthIndex] = r.value.summary;
          }
        }

        months.forEach(({ monthIndex }) => {
          if (!next[monthIndex]) {
            next[monthIndex] = {
              ...initialSummary,
              loaded: true,
              error: "load_error",
            };
          }
        });

        setAvailabilityByMonth(next);
      } catch {
        if (!cancelled) {
          const fallback: Record<number, MonthAvailabilitySummary> = {};
          months.forEach(({ monthIndex }) => {
            fallback[monthIndex] = {
              ...initialSummary,
              loaded: true,
              error: "load_error",
            };
          });
          setAvailabilityByMonth(fallback);
        }
      }
    }

    // No vaciar: mantener datos actuales visibles hasta que loadAll termine
    loadAll();

    return () => {
      cancelled = true;
      // limpiar timeouts pendientes
      Object.values(refreshTimerRef.current).forEach((id) =>
        window.clearTimeout(id),
      );
      refreshTimerRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localYear, i18n.language]);

  const handleAvailabilityInvalidated = React.useCallback(
    (p: { year: number; month: number }) => {
      // p.month viene 1..12
      scheduleRefreshMonth(p.year, p.month);
    },
    // scheduleRefreshMonth depende de localYear (y es estable dentro del render actual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localYear],
  );


  useVacationAvailabilityInvalidation(handleAvailabilityInvalidated);


  const monthBorderPriority = useMemo(() => {
    return months.map(({ start, end }) =>
      vacationMonthBorderPriority(requests, start, end),
    );
  }, [months, requests]);

  const monthBorderClass = (monthIndex: number) =>
    vacationRequestBorderClass(monthBorderPriority[monthIndex]);



  return (
    <div className="mb-4 p-0">
      {/* Barra superior: selector año (izquierda) + leyenda (derecha) */}
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        {/* IZQUIERDA: selector de año (estilo Sick) */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-slate-700">
            {t("common.year", "Año")}:
          </span>

          <div className="inline-flex items-center rounded-full ring-1 ring-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => handleYearDelta(-1)}
              className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
              aria-label={t("common.prev", "Anterior") as string}
              title={t("common.prev", "Anterior") as string}
            >
              ◀
            </button>

            <span className="px-4 py-1.5 text-sm font-medium text-slate-900 tabular-nums">
              {localYear}
            </span>

            <button
              type="button"
              onClick={() => handleYearDelta(1)}
              className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
              aria-label={t("common.next", "Siguiente") as string}
              title={t("common.next", "Siguiente") as string}
            >
              ▶
            </button>
          </div>
        </div>

        {/* DERECHA: leyenda */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border-2 border-amber-300" />
            {t("pages.vacations.legend.pending", "Pendientes")}
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border-2 border-sky-300" />
            {t("pages.vacations.legend.optionSent", "Alternativa")}
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border-2 border-emerald-300" />
            {t("pages.vacations.legend.accepted", "Aceptadas")}
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border-2 border-rose-300" />
            {t("pages.vacations.legend.cancelled", "Canceladas")}
          </span>
        </div>

      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map(({ monthIndex, label }) => {
          const count = counts[monthIndex] ?? 0;
          const hasItems = count > 0;

          const avail = availabilityByMonth[monthIndex] ?? initialSummary;
          const loaded = avail.loaded;
          const disabledStyle = !loaded ? "opacity-80" : "";

          const openMonth = () => {
            // Nuevo: apertura con mes + año (modal correcto)
            onMonthOpen?.(monthIndex, localYear);

            // Compat legacy (si alguien aún lo usa)
            onMonthClick?.(monthIndex);
          };

          return (
            <button
              key={monthIndex}
              type="button"
              onClick={openMonth}
              aria-label={t("pages.vacations.monthGrid.ariaOpenMonth", {
                label,
                year: localYear,
              })}
              className={[
                "group relative rounded-xl p-3 transition",
                // ✅ mismo estilo, solo cambia el color del borde según el estado
                `border bg-white hover:shadow-sm hover:-translate-y-0.5 ${monthBorderClass(monthIndex)}`,
                "focus:outline-none focus:ring-4 focus:ring-blue-100",
                "flex flex-col items-stretch justify-between min-h-[90px]",
                disabledStyle,
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900 inline-flex items-baseline gap-1.5 min-w-0 flex-wrap">
                  {label}
                  {loaded && !avail.error && (
                    <span className="text-xs font-normal text-slate-500 tabular-nums shrink-0">
                      {avail.maxPerDay}
                    </span>
                  )}
                </span>

                <span
                  className={[
                    "ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium border",
                    hasItems
                      ? "bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-100"
                      : "bg-slate-100 text-slate-600 border-slate-200",
                  ].join(" ")}
                  title={
                    t("pages.vacations.monthGrid.count", { count }) as string
                  }
                  aria-label={
                    t("pages.vacations.monthGrid.count", { count }) as string
                  }
                >
                  {count}
                </span>

              </div>

              {/* Resumen (solo contadores, sin amarillo) */}
              <div className="mt-3">
                {loaded ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-green-500" />
                        {avail.green}
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-red-500" />
                        {avail.red}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 animate-pulse">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-slate-200" />{" "}
                        —
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-slate-200" />{" "}
                        —
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminVacationMonthGrid;



