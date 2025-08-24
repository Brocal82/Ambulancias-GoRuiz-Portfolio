// src/components/vacation/AdminVacationMonthGrid.tsx
import React from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { getYearMonths, countRequestsByMonth } from '../../utils/vacationMonthUtils';
import { useTranslation } from 'react-i18next';
import { monthLabel as fmtMonth } from '../../utils/intl';

type Props = {
    requests: IVacationRequest[];
    year?: number;
    onMonthClick?: (monthIndex: number) => void;
};

const AdminVacationMonthGrid: React.FC<Props> = ({
    requests,
    year = new Date().getFullYear(),
    onMonthClick
}) => {
    const { t } = useTranslation();

    const months = getYearMonths(year);           // <- mantiene tu lógica actual
    const counts = countRequestsByMonth(requests, year);

    return (
        <div className="bg-white rounded-2xl shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    {t('pages.vacations.monthGrid.title', { year })}
                </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {months.map(({ monthIndex, label }) => {
                    const count = counts[monthIndex] ?? 0;
                    const hasItems = count > 0;

                    return (
                        <button
                            key={monthIndex}
                            type="button"
                            onClick={() => onMonthClick?.(monthIndex)}
                            aria-label={t('pages.vacations.monthGrid.ariaOpenMonth', {
                                label: fmtMonth(year, monthIndex),
                                year
                            })}
                            className={[
                                "group relative flex flex-col items-start justify-between rounded-xl border p-4 text-left transition",
                                hasItems
                                    ? "border-gray-200 hover:border-blue-400 hover:shadow"
                                    : "border-gray-200 opacity-60 hover:opacity-80 hover:border-gray-300",
                                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            ].join(' ')}
                        >
                            <span className="text-base font-medium">{fmtMonth(year, monthIndex)}</span>

                            <span
                                className={[
                                    "mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium",
                                    hasItems
                                        ? "bg-blue-50 text-blue-700 group-hover:bg-blue-100"
                                        : "bg-gray-100 text-gray-600"
                                ].join(' ')}
                            >
                                {t('pages.vacations.monthGrid.count', { count })}
                            </span>

                            {!hasItems && (
                                <span className="absolute right-3 top-3 text-xs text-gray-400">
                                    {t('pages.vacations.monthGrid.emptyBadge')}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminVacationMonthGrid;
