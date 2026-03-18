//src/modules/praemien/components/MonthlyMiniCalendar.tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MonthlyPraemienDay } from "../domain/api";

type Props = {
    days: MonthlyPraemienDay[];
};

// Lunes -> Domingo
const WEEKDAY_KEYS_MON = [1, 2, 3, 4, 5, 6, 0] as const;

function normalizeDateKey(dateStr: string): string {
    // Preferimos no tocar timezones: si viene "YYYY-MM-DD" o "YYYY-MM-DDT..."
    // nos quedamos con el día en formato YYYY-MM-DD.
    return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}

function daysInMonth(year: number, monthIndex0: number): number {
    // monthIndex0: 0..11
    return new Date(year, monthIndex0 + 1, 0).getDate();
}

function mondayIndex(jsDay: number): number {
    // JS: 0=Dom,1=Lun,...6=Sab -> queremos 0=Lun,...6=Dom
    return (jsDay + 6) % 7;
}

export default function MonthlyMiniCalendar({ days }: Props) {
    const { i18n, t } = useTranslation();

    const { monthTitle, cells } = useMemo(() => {
        // Si no hay días, igualmente renderizamos el mes actual vacío (sin valores)
        if (!days || days.length === 0) {
            const now = new Date();
            const year = now.getFullYear();
            const month0 = now.getMonth(); // 0..11

            const monthFormatter = new Intl.DateTimeFormat(i18n.language || undefined, {
                month: "long",
            });
            const yearFormatter = new Intl.DateTimeFormat(i18n.language || undefined, {
                year: "numeric",
            });

            const monthTitleLocal = `${monthFormatter.format(
                new Date(year, month0, 1),
            )} ${yearFormatter.format(new Date(year, month0, 1))}`;

            const totalDays = daysInMonth(year, month0);

            const firstOfMonth = new Date(year, month0, 1);
            const offset = mondayIndex(firstOfMonth.getDay()); // 0..6

            const result: Array<
                | { type: "empty"; key: string }
                | { type: "day"; key: string; dayNumber: number; value?: number }
            > = [];

            for (let i = 0; i < 42; i++) {
                const dayNum = i - offset + 1;
                if (dayNum < 1 || dayNum > totalDays) {
                    result.push({ type: "empty", key: `e-${i}` });
                    continue;
                }

                const monthStr = String(month0 + 1).padStart(2, "0");
                const dayStr = String(dayNum).padStart(2, "0");
                const key = `${year}-${monthStr}-${dayStr}`;

                result.push({
                    type: "day",
                    key,
                    dayNumber: dayNum,
                    value: undefined,
                });
            }

            return { monthTitle: monthTitleLocal, cells: result };
        }


        // Asumimos que "days" es del mes actual (lo que devuelve tu API).
        // Tomamos el primer elemento como referencia.
        const firstKey = normalizeDateKey(days[0].date);
        const ref = new Date(firstKey);
        const year = ref.getFullYear();
        const month0 = ref.getMonth(); // 0..11

        const monthFormatter = new Intl.DateTimeFormat(i18n.language || undefined, {
            month: "long",
        });
        const yearFormatter = new Intl.DateTimeFormat(i18n.language || undefined, {
            year: "numeric",
        });

        const monthTitleLocal = `${monthFormatter.format(
            new Date(year, month0, 1),
        )} ${yearFormatter.format(new Date(year, month0, 1))}`;


        // Mapa: YYYY-MM-DD -> pacientes/viajes contados
        const map = new Map<string, number>();
        for (const d of days) {
            map.set(normalizeDateKey(d.date), d.totalCountedPatients);
        }

        const totalDays = daysInMonth(year, month0);

        // Offset: cuántas celdas vacías antes del día 1, empezando en lunes
        const firstOfMonth = new Date(year, month0, 1);
        const offset = mondayIndex(firstOfMonth.getDay()); // 0..6

        // Hacemos una rejilla de 6 semanas (42 celdas) para consistencia visual
        const result: Array<
            | { type: "empty"; key: string }
            | { type: "day"; key: string; dayNumber: number; value?: number }
        > = [];

        for (let i = 0; i < 42; i++) {
            const dayNum = i - offset + 1; // 1..totalDays dentro del mes
            if (dayNum < 1 || dayNum > totalDays) {
                result.push({ type: "empty", key: `e-${i}` });
                continue;
            }

            const monthStr = String(month0 + 1).padStart(2, "0");
            const dayStr = String(dayNum).padStart(2, "0");
            const key = `${year}-${monthStr}-${dayStr}`; // YYYY-MM-DD "lógico"
            const value = map.get(key);

            result.push({
                type: "day",
                key,
                dayNumber: dayNum,
                value,
            });
        }

        return { monthTitle: monthTitleLocal, cells: result };
    }, [days, i18n.language]);

    const weekdayLabels = useMemo(() => {
        // Lunes -> Domingo, según locale
        const fmt = new Intl.DateTimeFormat(i18n.language || undefined, {
            weekday: "short",
        });

        // Elegimos una semana fija y ordenamos lunes->domingo
        const base = new Date(2025, 0, 6); // 2025-01-06 es lunes
        return WEEKDAY_KEYS_MON.map((_, idx) => {
            const d = new Date(base);
            d.setDate(base.getDate() + idx);
            // Normalizamos a 2-3 letras bonito (depende de locale)
            return fmt.format(d);
        });
    }, [i18n.language]);

    return (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
            {/* Header */}
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900">
                    {t("pages.praemien.page.dailyHistoryTitle")}
                </h2>

                <span className="text-xs text-slate-500 tabular-nums capitalize">
                    {monthTitle || "—"}
                </span>
            </div>


            {/* Weekday row */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-600 mb-2">
                {weekdayLabels.map((d) => (
                    <div key={d} className="py-0.5">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
                {cells.map((cell) => {
                    if (cell.type === "empty") {
                        return (
                            <div
                                key={cell.key}
                                className="h-9 rounded-lg bg-slate-50 ring-1 ring-slate-100"
                            />
                        );
                    }

                    const hasValue = typeof cell.value === "number";
                    const valueToShow = hasValue ? cell.value : undefined;

                    return (
                        <div
                            key={cell.key}
                            className={[
                                "h-9 rounded-lg ring-1 ring-slate-200 relative px-1",
                                valueToShow == null ? "bg-white" : "bg-blue-50",
                            ].join(" ")}

                        >

                            {/* Day number */}
                            <div className="absolute top-1 left-1 text-[9px] text-slate-500 tabular-nums">
                                {cell.dayNumber}
                            </div>

                            {/* Value */}
                            <div className="h-full flex items-center justify-center">
                                {valueToShow == null ? null : (
                                    <span className="text-[12px] font-semibold tabular-nums text-slate-900">
                                        {valueToShow}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

}
