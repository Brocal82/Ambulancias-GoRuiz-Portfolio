import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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

    const statsByLevel = useMemo(() => {
        return levels.map((threshold) => {
            let totalDifference = 0;
            for (const day of days) {
                totalDifference += day.totalCountedPatients - threshold;
            }

            const totalDays = days.length || 1;
            const averageDiff = totalDifference / totalDays;

            const percentage = Math.min(
                100,
                Math.max(0, (averagePatients / threshold) * 100),
            );

            return {
                threshold,
                percentage,
                averageDiff: Math.round(averageDiff * 2) / 2,
                isPositive: averageDiff >= 0,
            };
        });
    }, [averagePatients, days, levels]);

    return (
        <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 mb-8">
            {statsByLevel.map(({ threshold, percentage, averageDiff, isPositive }) => (
                <div key={threshold} className="mb-5 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-800">
                            {t("pages.praemien.page.patientsPerDay", { level: threshold })}
                        </span>

                        <span
                            className={[
                                "font-mono",
                                isPositive ? "text-emerald-600" : "text-red-600",
                            ].join(" ")}
                        >
                            {isPositive ? "+" : ""}
                            {averageDiff}
                        </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-200 ring-1 ring-slate-300 overflow-hidden">
                        <div
                            className={[
                                "h-3 rounded-full",
                                isPositive ? "bg-emerald-500" : "bg-red-500",
                                "transition-[width]",
                                `[--p:${percentage}%]`,
                                "w-[var(--p)]",
                            ].join(" ")}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
