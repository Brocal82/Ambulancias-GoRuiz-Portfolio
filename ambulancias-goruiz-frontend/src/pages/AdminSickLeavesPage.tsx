import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from '../utils/toast';
import { buildImageUrl } from '../utils/apiOrigins';
import { displayFileNameFromUrl } from '../utils/fileName';
import {
    adminListSickLeaves,
    adminAcceptSickLeave,
    adminRejectSickLeave,
    type SickLeave,
    type SickLeaveStatus,
} from '../api/sickLeaves';
import { getYearMonths, rangesOverlap } from '../utils/vacationMonthUtils';
import AdminSickMonthGrid from '../components/sick/AdminSickMonthGrid';

function fmtISO(d?: string, locale?: string) {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(locale || 'es');
}

const statusOptions: Array<{ value: '' | SickLeaveStatus; label: string }> = [
    { value: '', label: 'Todas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'accepted', label: 'Aceptadas' },
    { value: 'rejected', label: 'Rechazadas' },
];

export default function AdminSickLeavesPage() {
    const { token } = useAuth();
    const { t, i18n } = useTranslation();

    // === Datos principales (tabla completa por estado) ===
    const [items, setItems] = useState<SickLeave[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [status, setStatus] = useState<'' | SickLeaveStatus>('pending'); // por defecto, pendientes
    const [refreshKey, setRefreshKey] = useState(0);
    const [openDocsId, setOpenDocsId] = useState<string | null>(null);

    // === Datos para contadores del grid (todas las bajas, sin filtrar por estado) ===
    const [allItemsForCounts, setAllItemsForCounts] = useState<SickLeave[]>([]);
    const [loadingCounts, setLoadingCounts] = useState<boolean>(true);

    // === Filtro por año/mes (grid) ===
    const nowYear = new Date().getFullYear();
    const yearOptions = [nowYear - 1, nowYear, nowYear + 1];
    const [selectedYear, setSelectedYear] = useState<number>(nowYear);
    const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

    // Meses del año (labels localizados, TZ Berlin)
    const months = useMemo(
        () => getYearMonths(selectedYear, i18n.language || 'es', 'Europe/Berlin'),
        [selectedYear, i18n.language]
    );

    // Carga lista principal (filtra por estado vigente)
    const load = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const data = await adminListSickLeaves({
                status: status || undefined,
            });
            setItems(data);
        } catch (err: any) {
            console.error(err);
            toastT.error([err?.response?.data?.message || 'pages.sick.admin.listError']);
        } finally {
            setLoading(false);
        }
    };

    // Carga todas para contadores (no filtra por estado)
    const loadAllForCounts = async () => {
        if (!token) return;
        try {
            setLoadingCounts(true);
            const data = await adminListSickLeaves({}); // sin status => todas
            setAllItemsForCounts(data);
        } catch (err: any) {
            console.error(err);
            // silencioso
        } finally {
            setLoadingCounts(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, status, refreshKey]);

    useEffect(() => {
        loadAllForCounts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, refreshKey]);

    // === Conteos por mes (sobre todas las bajas del AÑO seleccionado) ===
    const monthlyCounts = useMemo(() => {
        if (!allItemsForCounts || allItemsForCounts.length === 0) return Array(12).fill(0);
        return months.map(({ start, end }) => {
            return allItemsForCounts.filter(sl => {
                const s = new Date(sl.startDate);
                const e = new Date(sl.endDate || sl.startDate);
                return rangesOverlap(s, e, start, end);
            }).length;
        });
    }, [allItemsForCounts, months]);

    // === Pendientes (SIEMPRE todas las pendientes, sin limitar por año) ===
    const pendingAll = useMemo(() => {
        if (!allItemsForCounts || allItemsForCounts.length === 0) return [];
        return allItemsForCounts.filter(sl => sl.status === 'pending');
    }, [allItemsForCounts]);

    // La sección "Pendientes" solo se muestra cuando NO hay mes seleccionado,
    // así que no aplicamos filtro por mes aquí.
    const pendingToShow = useMemo(() => pendingAll, [pendingAll]);


    // === Detalle del mes (todas las bajas del mes, cualquier estado) ===
    const monthDetailToShow = useMemo(() => {
        if (selectedMonthIndex === null) return [];
        const { start, end } = months[selectedMonthIndex];
        return allItemsForCounts.filter(sl => {
            const s = new Date(sl.startDate);
            const e = new Date(sl.endDate || sl.startDate);
            return rangesOverlap(s, e, start, end);
        });
    }, [allItemsForCounts, months, selectedMonthIndex]);

    // === Tabla principal (comportamiento original por estado) ===
    const dataToShowFullTable = items;
    const hasPendingsFullTable = dataToShowFullTable.some(it => it.status === 'pending');

    const onAccept = async (id: string) => {
        if (!token) return;
        const ok = window.confirm(
            t('pages.sick.admin.confirmAccept', '¿Aceptar esta baja y desasignar al trabajador en el rango?') as string
        );
        if (!ok) return;
        try {
            await adminAcceptSickLeave(id);
            toastT.success(['pages.sick.admin.acceptOk']);
            setRefreshKey((k) => k + 1);
        } catch (err: any) {
            console.error(err);
            toastT.error([err?.response?.data?.message || 'pages.sick.admin.acceptErr']);
        }
    };

    const onReject = async (id: string) => {
        if (!token) return;
        const ok = window.confirm(
            t('pages.sick.admin.confirmReject', '¿Rechazar esta baja?') as string
        );
        if (!ok) return;
        try {
            await adminRejectSickLeave(id);
            toastT.success(['pages.sick.admin.rejectOk']);
            setRefreshKey((k) => k + 1);
        } catch (err: any) {
            console.error(err);
            toastT.error([err?.response?.data?.message || 'pages.sick.admin.rejectErr']);
        }
    };

    const badge = (st: SickLeaveStatus) => {
        const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
        if (st === 'pending')
            return (
                <span className={`${base} bg-amber-100 text-amber-800`}>
                    {t('pages.sick.status.pending', 'Pendiente')}
                </span>
            );
        if (st === 'accepted')
            return (
                <span className={`${base} bg-emerald-100 text-emerald-800`}>
                    {t('pages.sick.status.accepted', 'Aceptada')}
                </span>
            );
        return (
            <span className={`${base} bg-rose-100 text-rose-800`}>
                {t('pages.sick.status.rejected', 'Rechazada')}
            </span>
        );
    };

    return (
        <div className="mx-auto max-w-5xl p-4">
            {/* Encabezado y filtros principales */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                        {t('pages.sick.admin.title', 'Bajas por enfermedad')}
                    </h1>
                    <p className="text-slate-600 text-sm">
                        {t('pages.sick.admin.subtitle', 'Gestiona solicitudes y documentos')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Selector de año */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="year-filter" className="text-xs sm:text-sm text-slate-700">
                            {t('pages.sick.admin.year', 'Año')}:
                        </label>
                        <select
                            id="year-filter"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro por estado (tabla grande) */}
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="sick-status-filter"
                            className="text-xs sm:text-sm text-slate-700"
                        >
                            {t('pages.sick.admin.filter', 'Estado')}:
                        </label>
                        <select
                            id="sick-status-filter"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as '' | SickLeaveStatus)}
                            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                        >
                            {statusOptions.map((opt) => (
                                <option key={opt.value || 'all'} value={opt.value}>
                                    {t(`pages.sick.admin.filter.${opt.value || 'all'}`, opt.label)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* === Grid minimalista === */}
            <AdminSickMonthGrid
                year={selectedYear}
                months={months}
                monthlyCounts={monthlyCounts}
                selectedMonthIndex={selectedMonthIndex}
                onSelect={(idx) => setSelectedMonthIndex(idx)}
                locale={i18n.language || 'es'}
                clearLabel={t('pages.sick.admin.grid.clear', 'Quitar filtro')}
                showingLabel={t('pages.sick.admin.grid.showing', 'Mostrando bajas que tocan')}
                countLabel={(n) => t('pages.sick.admin.grid.count', '{{n}} baja(s)', { n }) as string}
                compact
            />

            {/* === Si NO hay mes seleccionado: sección de PENDIENTES (por año) === */}
            {selectedMonthIndex === null && (
                <div className="mb-6 rounded-xl ring-1 ring-slate-200 bg-white">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-800">
                            {t('pages.sick.admin.pending.title', 'Pendientes')}
                            <span className="ml-2 text-slate-500">({pendingToShow.length})</span>
                        </div>
                        {loadingCounts && (
                            <div className="text-xs text-slate-500">
                                {t('common.loading', 'Cargando...')}
                            </div>
                        )}
                    </div>

                    {pendingToShow.length === 0 ? (
                        <div className="p-4 text-sm text-slate-600 text-center">
                            {t('pages.sick.admin.pending.empty', 'No hay bajas pendientes para este año')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full table-fixed text-sm">
                                <colgroup>
                                    <col className="w-[26%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[10%]" />
                                </colgroup>
                                <thead className="sticky top-0 bg-slate-50 z-10">
                                    <tr className="text-slate-600 border-b border-slate-200 text-center">
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.user', 'Trabajador')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.dates', 'Fechas')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.days', 'Días')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.status', 'Estado')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.doc', 'Documentos')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.actions', 'Acciones')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                    {pendingToShow.map((it) => {
                                        const u = (it.user as any) || {};
                                        const fullname = (u?.lastName ? `${u.lastName}, ` : '') + (u?.name ?? '—');

                                        return (
                                            <tr
                                                key={`pending-${it._id}`}
                                                className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                                            >
                                                {/* Trabajador */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="text-slate-800 font-medium truncate">{fullname || '—'}</div>
                                                    <div className="text-[11px] text-slate-500 truncate">{u?.email || '—'}</div>
                                                </td>
                                                {/* Fechas */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="text-slate-800 whitespace-nowrap">
                                                        {fmtISO(it.startDate, i18n.language)} — {fmtISO(it.endDate, i18n.language)}
                                                    </div>
                                                </td>
                                                {/* Días (inclusivo) */}
                                                <td className="px-3 py-2 align-top">
                                                    {(() => {
                                                        const s = new Date(it.startDate);
                                                        const e = new Date(it.endDate);
                                                        s.setHours(0, 0, 0, 0);
                                                        e.setHours(0, 0, 0, 0);
                                                        const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                                                        const days = isNaN(diff) ? '—' : Math.max(diff, 1);
                                                        return days;
                                                    })()}
                                                </td>
                                                {/* Estado */}
                                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                                    {badge(it.status)}
                                                </td>
                                                {/* Documentos */}
                                                <td className="px-3 py-2 align-top text-center">
                                                    {(() => {
                                                        const rawDocUrls: string[] = [
                                                            ...(it.documentUrl ? [it.documentUrl] : []),
                                                            ...(Array.isArray(it.documents) ? it.documents : []),
                                                        ];
                                                        const seen = new Set<string>();
                                                        const docUrls = rawDocUrls.filter((u) => {
                                                            const key = displayFileNameFromUrl(u).toLowerCase();
                                                            if (seen.has(key)) return false;
                                                            seen.add(key);
                                                            return true;
                                                        });

                                                        const count = docUrls.length;
                                                        const isOpen = openDocsId === it._id;

                                                        if (count === 0) {
                                                            return <span className="text-slate-500">{t('pages.sick.docs.none', 'Sin documento')}</span>;
                                                        }

                                                        return (
                                                            <div className="inline-flex flex-col items-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setOpenDocsId(isOpen ? null : it._id)}
                                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                    aria-expanded={isOpen}
                                                                    aria-controls={`docs-panel-pending-${it._id}`}
                                                                >
                                                                    <span className="whitespace-nowrap">
                                                                        {t('pages.sick.docs.count', '{{n}} documentos', { n: count })}
                                                                    </span>
                                                                </button>

                                                                <div
                                                                    id={`docs-panel-pending-${it._id}`}
                                                                    className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? 'opacity-100 max-h-56 mt-2' : 'opacity-0 max-h-0 mt-0'
                                                                        }`}
                                                                >
                                                                    <ul className="flex flex-wrap justify-center gap-2">
                                                                        {docUrls.map((url, idx) => {
                                                                            const label = displayFileNameFromUrl(url);
                                                                            return (
                                                                                <li
                                                                                    key={url + idx}
                                                                                    className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                                                                    title={label}
                                                                                >
                                                                                    <span aria-hidden="true" className="mr-1">📎</span>
                                                                                    <a
                                                                                        href={buildImageUrl(url)}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="truncate max-w-[180px] text-slate-700 hover:text-slate-900"
                                                                                    >
                                                                                        {label}
                                                                                    </a>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                {/* Acciones */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            className="h-8 inline-flex items-center rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                                            onClick={() => onAccept(it._id)}
                                                        >
                                                            {t('common.accept', 'Aceptar')}
                                                        </button>
                                                        <button
                                                            className="h-8 inline-flex items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100"
                                                            onClick={() => onReject(it._id)}
                                                        >
                                                            {t('common.reject', 'Rechazar')}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* === Si HAY mes seleccionado: DETALLE DEL MES (todas las bajas, cualquier estado) === */}
            {selectedMonthIndex !== null && (
                <div className="mb-6 rounded-xl ring-1 ring-slate-200 bg-white">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                            <span aria-hidden>🗓</span>
                            <span className="capitalize">
                                {t('pages.sick.admin.month.header', 'Bajas {{month}} {{year}}', {
                                    month: months[selectedMonthIndex!].label,
                                    year: selectedYear,
                                })}
                            </span>
                            <span className="text-slate-500">({monthDetailToShow.length})</span>
                        </div>
                    </div>


                    {monthDetailToShow.length === 0 ? (
                        <div className="p-4 text-sm text-slate-600 text-center">
                            {t('pages.sick.admin.month.empty', 'No hay bajas en este mes')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full table-fixed text-sm">
                                <colgroup>
                                    <col className="w-[26%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[10%]" />
                                </colgroup>
                                <thead className="sticky top-0 bg-slate-50 z-10">
                                    <tr className="text-slate-600 border-b border-slate-200 text-center">
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.user', 'Trabajador')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.dates', 'Fechas')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.days', 'Días')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.status', 'Estado')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.doc', 'Documentos')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.actions', 'Acciones')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                    {monthDetailToShow.map((it) => {
                                        const u = (it.user as any) || {};
                                        const fullname = (u?.lastName ? `${u.lastName}, ` : '') + (u?.name ?? '—');

                                        return (
                                            <tr
                                                key={`month-${it._id}`}
                                                className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                                            >
                                                {/* Trabajador */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="text-slate-800 font-medium truncate">{fullname || '—'}</div>
                                                    <div className="text-[11px] text-slate-500 truncate">{u?.email || '—'}</div>
                                                </td>
                                                {/* Fechas */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="text-slate-800 whitespace-nowrap">
                                                        {fmtISO(it.startDate, i18n.language)} — {fmtISO(it.endDate, i18n.language)}
                                                    </div>
                                                </td>
                                                {/* Días */}
                                                <td className="px-3 py-2 align-top">
                                                    {(() => {
                                                        const s = new Date(it.startDate);
                                                        const e = new Date(it.endDate);
                                                        s.setHours(0, 0, 0, 0);
                                                        e.setHours(0, 0, 0, 0);
                                                        const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                                                        const days = isNaN(diff) ? '—' : Math.max(diff, 1);
                                                        return days;
                                                    })()}
                                                </td>
                                                {/* Estado */}
                                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                                    {badge(it.status)}
                                                </td>
                                                {/* Documentos */}
                                                <td className="px-3 py-2 align-top text-center">
                                                    {(() => {
                                                        const rawDocUrls: string[] = [
                                                            ...(it.documentUrl ? [it.documentUrl] : []),
                                                            ...(Array.isArray(it.documents) ? it.documents : []),
                                                        ];
                                                        const seen = new Set<string>();
                                                        const docUrls = rawDocUrls.filter((u) => {
                                                            const key = displayFileNameFromUrl(u).toLowerCase();
                                                            if (seen.has(key)) return false;
                                                            seen.add(key);
                                                            return true;
                                                        });

                                                        const count = docUrls.length;
                                                        const isOpen = openDocsId === it._id;

                                                        if (count === 0) {
                                                            return <span className="text-slate-500">{t('pages.sick.docs.none', 'Sin documento')}</span>;
                                                        }

                                                        return (
                                                            <div className="inline-flex flex-col items-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setOpenDocsId(isOpen ? null : it._id)}
                                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                    aria-expanded={isOpen}
                                                                    aria-controls={`docs-panel-month-${it._id}`}
                                                                >
                                                                    <span className="whitespace-nowrap">
                                                                        {t('pages.sick.docs.count', '{{n}} documentos', { n: count })}
                                                                    </span>
                                                                </button>

                                                                <div
                                                                    id={`docs-panel-month-${it._id}`}
                                                                    className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? 'opacity-100 max-h-56 mt-2' : 'opacity-0 max-h-0 mt-0'
                                                                        }`}
                                                                >
                                                                    <ul className="flex flex-wrap justify-center gap-2">
                                                                        {docUrls.map((url, idx) => {
                                                                            const label = displayFileNameFromUrl(url);
                                                                            return (
                                                                                <li
                                                                                    key={url + idx}
                                                                                    className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                                                                    title={label}
                                                                                >
                                                                                    <span aria-hidden="true" className="mr-1">📎</span>
                                                                                    <a
                                                                                        href={buildImageUrl(url)}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="truncate max-w-[180px] text-slate-700 hover:text-slate-900"
                                                                                    >
                                                                                        {label}
                                                                                    </a>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                {/* Acciones: solo si está pendiente */}
                                                <td className="px-3 py-2 align-top">
                                                    {it.status === 'pending' ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                className="h-8 inline-flex items-center rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                                                onClick={() => onAccept(it._id)}
                                                            >
                                                                {t('common.accept', 'Aceptar')}
                                                            </button>
                                                            <button
                                                                className="h-8 inline-flex items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100"
                                                                onClick={() => onReject(it._id)}
                                                            >
                                                                {t('common.reject', 'Rechazar')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* === Tabla completa (comportamiento original por estado) === */}
            {status !== 'pending' && (
                <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
                    {loading && (
                        <div className="p-4 text-sm text-slate-600 text-center">
                            {t('common.loading', 'Cargando...')}
                        </div>
                    )}

                    {!loading && dataToShowFullTable.length === 0 && (
                        <div className="p-4 text-sm text-slate-600 text-center">
                            {t('pages.sick.admin.empty', 'No hay bajas con este filtro')}
                        </div>
                    )}

                    {!loading && dataToShowFullTable.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full table-fixed text-sm">
                                <colgroup>
                                    <col className="w-[26%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[10%]" /> {/* Días */}
                                    <col className="w-[16%]" />
                                    <col className="w-[18%]" />
                                    {/* Acciones solo si hay pendientes visibles */}
                                    {hasPendingsFullTable && <col className="w-[10%]" />}
                                </colgroup>

                                <thead className="sticky top-0 bg-slate-50 z-10">
                                    <tr className="text-slate-600 border-b border-slate-200 text-center">
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.user', 'Trabajador')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.dates', 'Fechas')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.days', 'Días')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.status', 'Estado')}
                                        </th>
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.doc', 'Documentos')}
                                        </th>
                                        {hasPendingsFullTable && (
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                {t('pages.sick.admin.th.actions', 'Acciones')}
                                            </th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                    {dataToShowFullTable.map((it) => {
                                        const u = it.user as any;
                                        const fullname = (u?.lastName ? `${u.lastName}, ` : '') + (u?.name ?? '—');

                                        return (
                                            <tr key={it._id} className="border-b border-slate-100 hover:bg-slate-50/70 text-center">
                                                {/* Trabajador */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="text-slate-800 font-medium truncate">{fullname || '—'}</div>
                                                    <div className="text-[11px] text-slate-500 truncate">{u?.email || '—'}</div>
                                                </td>

                                                {/* Fechas */}
                                                <td className="px-3 py-2 align-top">
                                                    <div className="text-slate-800 whitespace-nowrap">
                                                        {fmtISO(it.startDate, i18n.language)} — {fmtISO(it.endDate, i18n.language)}
                                                    </div>
                                                </td>

                                                {/* Días */}
                                                <td className="px-3 py-2 align-top">
                                                    {(() => {
                                                        const s = new Date(it.startDate);
                                                        const e = new Date(it.endDate);
                                                        s.setHours(0, 0, 0, 0);
                                                        e.setHours(0, 0, 0, 0);
                                                        const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                                                        const days = isNaN(diff) ? '—' : Math.max(diff, 1);
                                                        return days;
                                                    })()}
                                                </td>

                                                {/* Estado */}
                                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                                    {badge(it.status)}
                                                </td>

                                                {/* Documentos */}
                                                <td className="px-3 py-2 align-top text-center">
                                                    {(() => {
                                                        const rawDocUrls: string[] = [
                                                            ...(it.documentUrl ? [it.documentUrl] : []),
                                                            ...(Array.isArray(it.documents) ? it.documents : []),
                                                        ];
                                                        const seen = new Set<string>();
                                                        const docUrls = rawDocUrls.filter((u) => {
                                                            const key = displayFileNameFromUrl(u).toLowerCase();
                                                            if (seen.has(key)) return false;
                                                            seen.add(key);
                                                            return true;
                                                        });

                                                        const count = docUrls.length;
                                                        const isOpen = openDocsId === it._id;

                                                        if (count === 0) {
                                                            return <span className="text-slate-500">{t('pages.sick.docs.none', 'Sin documento')}</span>;
                                                        }

                                                        return (
                                                            <div className="inline-flex flex-col items-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setOpenDocsId(isOpen ? null : it._id)}
                                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                    aria-expanded={isOpen}
                                                                    aria-controls={`docs-panel-${it._id}`}
                                                                >
                                                                    <span className="whitespace-nowrap">
                                                                        {t('pages.sick.docs.count', '{{n}} documentos', { n: count })}
                                                                    </span>
                                                                </button>

                                                                <div
                                                                    id={`docs-panel-${it._id}`}
                                                                    className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? 'opacity-100 max-h-56 mt-2' : 'opacity-0 max-h-0 mt-0'
                                                                        }`}
                                                                >
                                                                    <ul className="flex flex-wrap justify-center gap-2">
                                                                        {docUrls.map((url, idx) => {
                                                                            const label = displayFileNameFromUrl(url);
                                                                            return (
                                                                                <li
                                                                                    key={url + idx}
                                                                                    className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                                                                    title={label}
                                                                                >
                                                                                    <span aria-hidden="true" className="mr-1">📎</span>
                                                                                    <a
                                                                                        href={buildImageUrl(url)}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="truncate max-w-[180px] text-slate-700 hover:text-slate-900"
                                                                                    >
                                                                                        {label}
                                                                                    </a>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Acciones: solo si está pendiente */}
                                                {hasPendingsFullTable && (
                                                    <td className="px-3 py-2 align-top">
                                                        {it.status === 'pending' ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    className="h-8 inline-flex items-center rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                                                    onClick={() => onAccept(it._id)}
                                                                >
                                                                    {t('common.accept', 'Aceptar')}
                                                                </button>
                                                                <button
                                                                    className="h-8 inline-flex items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100"
                                                                    onClick={() => onReject(it._id)}
                                                                >
                                                                    {t('common.reject', 'Rechazar')}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">—</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
