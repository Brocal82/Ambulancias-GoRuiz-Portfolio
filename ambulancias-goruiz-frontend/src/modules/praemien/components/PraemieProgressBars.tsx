//src/modules/praemien/components/PraemieProgressBars.tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
    getPraemieI18nKey,
    getPraemieLevelFromAverage,
} from "../utils/praemienLevels";

type Props = {
    averagePatients: number;
    days: Array<{ totalCountedPatients: number }>;
    levels?: number[];
};

const DEFAULT_LEVELS = [7, 8, 9, 10];

export default function PraemieProgressBars({
    averagePatients,
    days,
    levels = DEFAULT_LEVELS,
}: Props) {
    const { t } = useTranslation();

    const globalLevelLabel = useMemo(() => {
        const level = getPraemieLevelFromAverage(averagePatients);
        return t(getPraemieI18nKey(level));
    }, [averagePatients, t]);

    const statsByLevel = useMemo(() => {
        return levels.map((threshold) => {
            let totalDifference = 0;
            for (const day of days) {
                totalDifference += day.totalCountedPatients - threshold;
            }
            const accumulatedDiff = totalDifference;

            const percentage = Math.min(
                100,
                Math.max(0, (averagePatients / threshold) * 100),
            );

            return {
                threshold,
                percentage,
                averageDiff: Math.round(accumulatedDiff * 2) / 2,
                isPositive: accumulatedDiff >= 0,
            };
        });
    }, [averagePatients, days, levels]);

    return (
        <div className="mx-auto max-w-4xl mb-8">
            {/* Tarjeta principal */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
                {/* Nivel global (título del bloque) */}
                {averagePatients > 0 && (
                    <h2 className="text-center mb-4 text-lg font-semibold text-slate-800">
                        {t("pages.praemien.page.globalLevel")}{" "}
                        <span className="text-blue-600">
                            {globalLevelLabel}
                        </span>
                    </h2>


                )}

                {/* Columnas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {statsByLevel.map(
                        ({ threshold, percentage, averageDiff, isPositive }) => (
                            <div key={threshold} className="flex flex-col gap-1">
                                {/* Header columna */}
                                <div className="text-[12px] font-semibold text-slate-800 text-center">
                                    Prämie {threshold}
                                </div>

                                {/* Línea / tarjeta interior */}
                                <div className="rounded-xl ring-1 ring-slate-200 bg-white px-3 py-2.5">
                                    <div className="flex items-baseline justify-between">
                                        {/* Diferencia */}
                                        <span
                                            className={[
                                                "font-mono tabular-nums text-[14px] font-semibold",
                                                isPositive ? "text-emerald-600" : "text-red-600",
                                            ].join(" ")}
                                        >
                                            {isPositive ? "+" : ""}
                                            {averageDiff}
                                        </span>

                                        {/* Porcentaje */}
                                        <span className="text-[10px] text-slate-400 tabular-nums">
                                            {Math.round(percentage)}%
                                        </span>
                                    </div>

                                    {/* Barra lineal */}
                                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                            className={[
                                                "h-1.5 rounded-full",
                                                isPositive ? "bg-emerald-500" : "bg-red-500",
                                                "transition-[width]",
                                                `[--p:${percentage}%]`,
                                                "w-[var(--p)]",
                                            ].join(" ")}
                                        />
                                    </div>
                                </div>
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}
