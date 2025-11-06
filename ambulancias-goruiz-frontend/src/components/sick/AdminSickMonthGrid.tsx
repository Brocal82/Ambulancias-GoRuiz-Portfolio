// frontend/src/components/sick/AdminSickMonthGrid.tsx
import React from 'react';
import type { MonthInfo } from '../../utils/vacationMonthUtils';

type Props = {
    year: number;
    months: MonthInfo[];            // getYearMonths(...)
    monthlyCounts: number[];        // longitud 12
    selectedMonthIndex: number | null;
    onSelect: (index: number | null) => void;
    locale?: string;                // p.ej. i18n.language
    // Las siguientes props pueden seguir viniendo desde el padre, pero aquí no se usan.
    clearLabel?: string;
    showingLabel?: string;
    countLabel?: (n: number) => string;
    compact?: boolean;
};

const AdminSickMonthGrid: React.FC<Props> = ({
    year,
    months,
    monthlyCounts,
    selectedMonthIndex,
    onSelect,
    locale = 'es',
    // no usamos clearLabel/showingLabel
    countLabel = (n: number) => `${n} baja${n === 1 ? '' : 's'}`,
    compact = true,
}) => {
    const wrapperClass = compact
        ? 'mb-4 rounded-xl ring-1 ring-slate-200 bg-white p-3'
        : 'mb-4 rounded-2xl bg-white ring-1 ring-slate-200 shadow p-4';

    return (
        <div className={wrapperClass}>
            <div className="mb-2 text-sm text-slate-500">{year}</div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {months.map((m, i) => {
                    const selected = selectedMonthIndex === i;
                    const count = monthlyCounts[i] ?? 0;
                    const short = new Intl.DateTimeFormat(locale, { month: 'short' }).format(m.start);

                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onSelect(selected ? null : i)} // toggle en el propio botón
                            className={[
                                'relative rounded-xl border transition text-left',
                                'focus:outline-none focus:ring-2 focus:ring-offset-0 sm:focus:ring-offset-2',
                                selected
                                    ? 'border-blue-500 ring-1 ring-blue-300 bg-blue-50'
                                    : 'border-slate-200 hover:shadow-sm',
                                compact ? 'px-3 py-2' : 'p-4',
                            ].join(' ')}
                            aria-pressed={selected}
                        >
                            <div className="font-medium text-slate-900">
                                <span className="sm:hidden capitalize">{short}</span>
                                <span className="hidden sm:inline capitalize">{m.label}</span>
                            </div>

                            <div className="mt-1 sm:mt-2">
                                <span
                                    className={[
                                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-medium border',
                                        count > 0
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                            : 'bg-slate-100 text-slate-500 border-slate-200',
                                    ].join(' ')}
                                >
                                    {countLabel(count)}
                                </span>
                            </div>

                        </button>
                    );
                })}
            </div>

            {/* Eliminado: sin “Mostrando bajas que tocan … / Quitar filtro” */}
        </div>
    );
};

export default AdminSickMonthGrid;
