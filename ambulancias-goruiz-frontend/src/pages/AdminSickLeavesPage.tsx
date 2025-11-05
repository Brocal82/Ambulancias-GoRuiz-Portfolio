import { useEffect, useState } from 'react';
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

    const [items, setItems] = useState<SickLeave[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [status, setStatus] = useState<'' | SickLeaveStatus>('pending'); // por defecto, pendientes
    const [refreshKey, setRefreshKey] = useState(0);
    const [openDocsId, setOpenDocsId] = useState<string | null>(null);


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
            // usar clave i18n o mensaje del backend si existe
            toastT.error([err?.response?.data?.message || 'pages.sick.admin.listError']);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, status, refreshKey]);

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

    const hasPendings = items.some(it => it.status === 'pending');


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
            {/* Encabezado y filtro */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                        {t('pages.sick.admin.title', 'Bajas por enfermedad')}
                    </h1>
                    <p className="text-slate-600 text-sm">
                        {t('pages.sick.admin.subtitle', 'Gestiona solicitudes y documentos')}
                    </p>
                </div>

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

            {/* Contenedor principal */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
                {loading && (
                    <div className="p-4 text-sm text-slate-600 text-center">
                        {t('common.loading', 'Cargando...')}
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="p-4 text-sm text-slate-600 text-center">
                        {t('pages.sick.admin.empty', 'No hay bajas con este filtro')}
                    </div>
                )}

                {!loading && items.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed text-sm">
                            <colgroup>
                                <col className="w-[26%]" />
                                <col className="w-[20%]" />
                                <col className="w-[10%]" /> {/* Días */}
                                <col className="w-[16%]" />
                                <col className="w-[18%]" />
                                {/* Acciones solo si hay pendientes */}
                                {hasPendings && <col className="w-[10%]" />}

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
                                        {t('pages.sick.admin.th.doc', 'Documento')}
                                    </th>
                                    {hasPendings && (
                                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                            {t('pages.sick.admin.th.actions', 'Acciones')}
                                        </th>
                                    )}

                                </tr>
                            </thead>

                            <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                {items.map((it) => {
                                    const u = it.user as any;
                                    const fullname =
                                        (u?.lastName ? `${u.lastName}, ` : '') + (u?.name ?? '—');

                                    return (
                                        <tr
                                            key={it._id}
                                            className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                                        >
                                            {/* Trabajador */}
                                            <td className="px-3 py-2 align-top">
                                                <div className="text-slate-800 font-medium truncate">
                                                    {fullname || '—'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate">
                                                    {u?.email || '—'}
                                                </div>
                                            </td>

                                            {/* Fechas */}
                                            <td className="px-3 py-2 align-top">
                                                <div className="text-slate-800 whitespace-nowrap">
                                                    {fmtISO(it.startDate, i18n.language)} — {fmtISO(it.endDate, i18n.language)}
                                                </div>
                                            </td>

                                            {/* Días (cálculo inclusivo) */}
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

                                            {/* Documentos: con desplegable animado (slide + fade) */}
                                            <td className="px-3 py-2 align-top text-center">
                                                {(() => {
                                                    const hasArray = Array.isArray(it.documents) && it.documents.length > 0;
                                                    const count = hasArray ? it.documents!.length : it.documentUrl ? 1 : 0;
                                                    const isOpen = openDocsId === it._id;

                                                    if (count === 0) {
                                                        return (
                                                            <span className="text-slate-500">
                                                                {t('pages.sick.docs.none', 'Sin documento')}
                                                            </span>
                                                        );
                                                    }

                                                    // Un único documento (array o legacy)
                                                    if (count === 1) {
                                                        const singleUrl = hasArray ? it.documents![0] : it.documentUrl!;
                                                        const label = displayFileNameFromUrl(singleUrl); // ← AÑADIDO
                                                        return (
                                                            <div className="inline-flex items-center gap-1">
                                                                <span className="text-slate-500" aria-hidden="true">📎</span>
                                                                <a
                                                                    href={buildImageUrl(singleUrl)}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-blue-600 underline hover:text-blue-800 truncate inline-block max-w-full"
                                                                >
                                                                    {label} {/* ← USAMOS EL NOMBRE LIMPIO */}
                                                                </a>
                                                            </div>
                                                        );
                                                    }


                                                    // Varios documentos → botón + panel animado
                                                    return (
                                                        <div className="inline-block text-left">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenDocsId(isOpen ? null : it._id)}
                                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                aria-expanded={isOpen}
                                                                aria-controls={`docs-panel-${it._id}`}
                                                            >
                                                                <span aria-hidden="true">📎</span>
                                                                <span className="whitespace-nowrap">
                                                                    {t('pages.sick.docs.count', '{{n}} documentos', { n: count })}
                                                                </span>
                                                                <span
                                                                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                                                    aria-hidden="true"
                                                                >
                                                                    ▾
                                                                </span>
                                                            </button>

                                                            <div
                                                                id={`docs-panel-${it._id}`}
                                                                className={`overflow-hidden transition-all duration-200 ease-out mt-1 
    ${isOpen ? 'opacity-100 max-h-56' : 'opacity-0 max-h-0'}`}
                                                            >
                                                                <ul className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-2 space-y-1">
                                                                    {it.documents!.map((docUrl, idx) => {
                                                                        const label = displayFileNameFromUrl(docUrl); // ← AÑADIDO
                                                                        return (
                                                                            <li key={docUrl + idx} className="flex items-center gap-1">
                                                                                <span className="text-slate-500" aria-hidden="true">📎</span>
                                                                                <a
                                                                                    href={buildImageUrl(docUrl)}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="text-blue-600 underline hover:text-blue-800 truncate inline-block max-w-full"
                                                                                >
                                                                                    {label} {/* ← USAMOS EL NOMBRE LIMPIO */}
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


                                            {/* Acciones: solo si está pendiente y si existe la columna */}
                                            {hasPendings && (
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
        </div>
    );



}
