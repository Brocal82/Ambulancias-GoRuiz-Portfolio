import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from '../utils/toast';
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

    const verifBadge = (v?: string) => {
        if (!v) return null;
        const base =
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ml-2';
        if (v === 'pending')
            return (
                <span className={`${base} bg-blue-100 text-blue-800`}>
                    {t('pages.sick.verification.pending', 'Doc. pendiente')}
                </span>
            );
        if (v === 'received')
            return (
                <span className={`${base} bg-emerald-100 text-emerald-800`}>
                    {t('pages.sick.verification.received', 'Doc. recibido')}
                </span>
            );
        if (v === 'overdue')
            return (
                <span className={`${base} bg-rose-100 text-rose-800`}>
                    {t('pages.sick.verification.overdue', 'Doc. vencido')}
                </span>
            );
        return (
            <span className={`${base} bg-slate-100 text-slate-700`}>
                {t('pages.sick.verification.notRequired', 'Doc. no requerido')}
            </span>
        );
    };

    const counts = useMemo(() => {
        const c = { pending: 0, accepted: 0, rejected: 0 };
        for (const it of items) {
            if (it.status === 'pending') c.pending++;
            else if (it.status === 'accepted') c.accepted++;
            else c.rejected++;
        }
        return c;
    }, [items]);

    return (
        <div className="mx-auto max-w-5xl p-4">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                        {t('pages.sick.admin.title', 'Bajas por enfermedad')}
                    </h1>
                    <p className="text-slate-600 text-sm">
                        {t('pages.sick.admin.subtitle', 'Gestiona solicitudes y documentos')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="sick-status-filter"
                        className="text-sm text-slate-700"
                    >
                        {t('pages.sick.admin.filter', 'Estado')}:
                    </label>
                    <select
                        id="sick-status-filter"
                        aria-label={t('pages.sick.admin.filter', 'Estado')}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as '' | SickLeaveStatus)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value || 'all'} value={opt.value}>
                                {t(`pages.sick.admin.filter.${opt.value || 'all'}`, opt.label)}
                            </option>
                        ))}
                    </select>

                </div>
            </div>

            <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow p-4">
                {loading && (
                    <div className="text-sm text-slate-600">
                        {t('common.loading', 'Cargando...')}
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="text-sm text-slate-600">
                        {t('pages.sick.admin.empty', 'No hay bajas con este filtro')}
                    </div>
                )}

                {!loading && items.length > 0 && (
                    <>
                        <div className="text-xs text-slate-500 mb-2">
                            {t(
                                'pages.sick.admin.counts',
                                'Pendientes: {{p}} · Aceptadas: {{a}} · Rechazadas: {{r}}',
                                {
                                    p: counts.pending,
                                    a: counts.accepted,
                                    r: counts.rejected,
                                }
                            )}
                        </div>

                        <div className="overflow-x-auto -mx-2 sm:mx-0">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-600 border-b border-slate-200">
                                        <th className="px-2 py-2">
                                            {t('pages.sick.admin.th.user', 'Trabajador')}
                                        </th>
                                        <th className="px-2 py-2">
                                            {t('pages.sick.admin.th.dates', 'Fechas')}
                                        </th>
                                        <th className="px-2 py-2">
                                            {t('pages.sick.admin.th.status', 'Estado')}
                                        </th>
                                        <th className="px-2 py-2">
                                            {t('pages.sick.admin.th.doc', 'Documento')}
                                        </th>
                                        <th className="px-2 py-2">
                                            {t('pages.sick.admin.th.actions', 'Acciones')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it) => {
                                        const u = it.user as any;
                                        const fullname =
                                            (u?.lastName ? `${u.lastName}, ` : '') + (u?.name ?? '—');
                                        const canAccept = it.status === 'pending';
                                        const canReject = it.status === 'pending';

                                        return (
                                            <tr key={it._id} className="border-b border-slate-100">
                                                <td className="px-2 py-2">
                                                    <div className="text-slate-800 font-medium">
                                                        {fullname || '—'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {u?.email || '—'}
                                                    </div>
                                                </td>

                                                <td className="px-2 py-2">
                                                    <div className="text-slate-800">
                                                        {fmtISO(it.startDate, i18n.language)} —{' '}
                                                        {fmtISO(it.endDate, i18n.language)}
                                                    </div>
                                                    {it.requiresDocument && it.documentDueAt && (
                                                        <div className="text-[11px] text-slate-500">
                                                            {t('pages.sick.docs.due', 'Doc. hasta')}:{' '}
                                                            {fmtISO(it.documentDueAt, i18n.language)}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-2 py-2">
                                                    {badge(it.status)} {verifBadge(it.verificationStatus)}
                                                </td>

                                                <td className="px-2 py-2">
                                                    {it.documentUrl ? (
                                                        <a
                                                            href={it.documentUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-blue-600 underline"
                                                        >
                                                            {t('pages.sick.docs.view', 'Ver documento')}
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-500">
                                                            {t('pages.sick.docs.none', 'Sin documento')}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-2 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
                                                            disabled={!canAccept}
                                                            onClick={() => onAccept(it._id)}
                                                        >
                                                            {t('common.accept', 'Aceptar')}
                                                        </button>
                                                        <button
                                                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-50"
                                                            disabled={!canReject}
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
                    </>
                )}
            </div>
        </div>
    );
}
