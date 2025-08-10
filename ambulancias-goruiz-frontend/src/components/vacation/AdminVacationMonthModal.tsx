// src/components/vacation/AdminVacationMonthModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { filterRequestsByMonth, getYearMonths } from '../../utils/vacationMonthUtils';
import { updateVacationRequest, deleteVacationRequest } from '../../api/vacation';
import AlternativeDateModal from './AlternativeDateModal';
import { useAuth } from '../../hooks/useAuth';

type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';

interface Props {
    isOpen: boolean;
    monthIndex: number | null; // 0=Enero ... 11=Diciembre
    requests: IVacationRequest[];
    year?: number; // por defecto, año actual
    onClose: () => void;
    onActionDone?: () => void; // para llamar fetchRequests() desde el padre
}

const AdminVacationMonthModal: React.FC<Props> = ({
    isOpen,
    monthIndex,
    requests,
    year = new Date().getFullYear(),
    onClose,
    onActionDone,
}) => {
    const { token } = useAuth();

    // ---- filtros y ordenación internos (UX extra)
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | VacationStatus>('');
    const [sortAsc, setSortAsc] = useState(true);

    // ---- estados para "Cancelar con motivo"
    const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
    const [cancelMessage, setCancelMessage] = useState('');
    const [isSendingCancel, setIsSendingCancel] = useState(false);

    // ---- estados para "Opción 2" (reusar tu AlternativeDateModal)
    const [isAltOpen, setIsAltOpen] = useState(false);
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [altInitialStart, setAltInitialStart] = useState<Date>(new Date());
    const [altInitialEnd, setAltInitialEnd] = useState<Date>(new Date());

    // ---- a11y: foco en botón cerrar + Escape
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        if (!isOpen) return;
        closeBtnRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    // ---- etiqueta del mes (segura cuando monthIndex es null)
    const monthLabel = useMemo(() => {
        if (monthIndex === null) return '';
        const info = getYearMonths(year)[monthIndex];
        return `${info.label} · ${year}`;
    }, [monthIndex, year]);

    // ---- solicitudes del mes (incluye rangos que cruzan meses)
    const monthRequests = useMemo(() => {
        if (monthIndex === null) return [];
        return filterRequestsByMonth(requests, monthIndex, year);
    }, [requests, monthIndex, year]);

    const monthCount = monthRequests.length;

    const statusCounts = useMemo(() => {
        const acc = { pending: 0, accepted: 0, cancelled: 0, option_sent: 0 };
        for (const r of monthRequests) acc[r.status]++;
        return acc;
    }, [monthRequests]);

    // ---- aplicar filtros y ordenación
    const filtered = useMemo(() => {
        let items = monthRequests;

        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            items = items.filter(r => {
                const name = `${r.user?.name ?? ''} ${r.user?.lastName ?? ''}`.toLowerCase();
                return name.includes(q);
            });
        }
        if (statusFilter) {
            items = items.filter(r => r.status === statusFilter);
        }

        items = [...items].sort((a, b) => {
            const aStart = new Date(a.startDate).getTime();
            const bStart = new Date(b.startDate).getTime();
            return sortAsc ? aStart - bStart : bStart - aStart;
        });

        return items;
    }, [monthRequests, searchText, statusFilter, sortAsc]);

    // ---- helpers
    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Berlin' });

    const statusBadge = (status: VacationStatus) => {
        const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
        switch (status) {
            case 'accepted':
                return <span className={`${base} bg-green-100 text-green-700`}>Aceptada</span>;
            case 'cancelled':
                return <span className={`${base} bg-red-100 text-red-700`}>Rechazada</span>;
            case 'option_sent':
                return <span className={`${base} bg-blue-100 text-blue-700`}>Opción enviada</span>;
            default:
                return <span className={`${base} bg-yellow-100 text-yellow-700`}>Pendiente</span>;
        }
    };

    // ---- acciones (reusan tu API actual)
    const handleAccept = async (id: string) => {
        if (!token) return;
        try {
            await updateVacationRequest(token, id, { status: 'accepted' });
            onActionDone?.();
        } catch {
            alert('Error actualizando la solicitud');
        }
    };

    const openAlternative = (req: IVacationRequest) => {
        setCurrentRequestId(req._id);
        setAltInitialStart(new Date(req.startDate));
        setAltInitialEnd(new Date(req.endDate));
        setIsAltOpen(true);
    };

    const handleAlternativeSubmit = async (altStartISO: string, altEndISO: string, note: string) => {
        if (!token || !currentRequestId) return;
        try {
            await updateVacationRequest(token, currentRequestId, {
                status: 'option_sent',
                adminOptionStartDate: altStartISO,
                adminOptionEndDate: altEndISO,
                adminNote: note,
            });
            setIsAltOpen(false);
            setCurrentRequestId(null);
            onActionDone?.();
        } catch {
            alert('Error enviando opción alternativa');
        }
    };

    const handleStartCancelFlow = (id: string) => {
        setCancelingRequestId(id);
        setCancelMessage('');
    };

    const handleConfirmCancel = async (id: string) => {
        if (!token) return;
        setIsSendingCancel(true);
        try {
            await updateVacationRequest(token, id, {
                status: 'cancelled',
                adminNote: cancelMessage,
            });
            setCancelingRequestId(null);
            setCancelMessage('');
            onActionDone?.();
        } catch {
            alert('Error al cancelar la solicitud');
        } finally {
            setIsSendingCancel(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        if (!window.confirm('¿Seguro que quieres eliminar esta solicitud?')) return;
        try {
            await deleteVacationRequest(token, id);
            onActionDone?.();
        } catch {
            alert('Error al eliminar la solicitud');
        }
    };

    // ---- IMPORTANTE: ahora SÍ devolvemos null, pero DESPUÉS de declarar todos los hooks
    if (!isOpen || monthIndex === null) return null;


    return (
        <>
            {/* Overlay + Panel */}
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
                <div className="fixed inset-0 bg-black/40" onClick={onClose} />

                <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-lg" role="dialog" aria-modal="true" aria-labelledby="vacation-month-modal-title">

                    {/* Header */}
                    <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 id="vacation-month-modal-title" className="text-lg font-semibold">{monthLabel}</h3>
                            <p className="mt-0.5 text-sm text-gray-600">
                                {monthCount} {monthCount === 1 ? 'solicitud' : 'solicitudes'} en este mes
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('')}
                                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === '' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
                                aria-label="Mostrar todos los estados"
                            >
                                Todas {monthCount > 0 ? `(${monthCount})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('pending')}
                                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'pending' ? 'bg-yellow-500 text-white border-yellow-500' : 'hover:bg-yellow-50 border-yellow-300 text-yellow-700'}`}
                                aria-label="Filtrar pendientes"
                            >
                                Pendientes {statusCounts.pending ? `(${statusCounts.pending})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('accepted')}
                                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'accepted' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-green-50 border-green-300 text-green-700'}`}
                                aria-label="Filtrar aceptadas"
                            >
                                Aceptadas {statusCounts.accepted ? `(${statusCounts.accepted})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('cancelled')}
                                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'cancelled' ? 'bg-red-600 text-white border-red-600' : 'hover:bg-red-50 border-red-300 text-red-700'}`}
                                aria-label="Filtrar rechazadas"
                            >
                                Rechazadas {statusCounts.cancelled ? `(${statusCounts.cancelled})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('option_sent')}
                                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'option_sent' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-blue-50 border-blue-300 text-blue-700'}`}
                                aria-label="Filtrar con opción enviada"
                            >
                                Opción enviada {statusCounts.option_sent ? `(${statusCounts.option_sent})` : ''}
                            </button>

                            <button
                                ref={closeBtnRef}
                                aria-label="Cerrar"
                                onClick={onClose}
                                className="ml-auto rounded p-2 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                            >
                                ✕
                            </button>

                        </div>
                    </div>


                    {/* Filtros */}
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-2">
                            {/* Filtro por usuario */}
                            <div className="flex flex-col">
                                <label htmlFor="vacation-filter-user" className="sr-only">
                                    Filtrar por usuario
                                </label>
                                <input
                                    id="vacation-filter-user"
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Filtrar por usuario..."
                                    aria-label="Filtrar por usuario"
                                    className="w-full rounded-md border px-3 py-2 text-sm sm:w-64"
                                />
                            </div>

                            {/* Filtro por estado */}
                            <div className="flex flex-col">
                                <label htmlFor="vacation-filter-status" className="sr-only">
                                    Filtrar por estado
                                </label>
                                <select
                                    id="vacation-filter-status"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    aria-label="Filtrar por estado"
                                    className="rounded-md border px-3 py-2 text-sm"
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="accepted">Aceptada</option>
                                    <option value="cancelled">Rechazada</option>
                                    <option value="option_sent">Opción enviada</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={() => setSortAsc((v) => !v)}
                            aria-label={`Cambiar orden por fecha de inicio (${sortAsc ? 'ascendente' : 'descendente'})`}
                            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Orden: inicio {sortAsc ? '↑' : '↓'}
                        </button>
                    </div>


                    {/* Lista */}
                    <div className="max-h-[70vh] overflow-y-auto p-4">
                        {filtered.length === 0 ? (
                            <p className="text-center text-sm text-gray-500">No hay solicitudes en este mes.</p>
                        ) : (
                            <ul className="space-y-3">
                                {filtered.map((req) => (
                                    <li key={req._id} className="rounded-xl border p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            {/* ← Reemplaza este inner div por el nuevo */}
                                            <div className="min-w-0">
                                                <div className="font-medium">
                                                    {req.user ? `${req.user.lastName}, ${req.user.name}` : 'Usuario no disponible'}
                                                </div>

                                                <div className="mt-0.5 text-sm grid grid-cols-[auto,1fr] gap-x-2">
                                                    {/* Rango solicitado */}
                                                    <span className="font-medium text-gray-700">Solicitado:</span>
                                                    <span className="text-gray-600">
                                                        {fmtDate(req.startDate)} — {fmtDate(req.endDate)}
                                                    </span>

                                                    {/* Opción alternativa (si existe) */}
                                                    {req.adminOptionStartDate && req.adminOptionEndDate && (
                                                        <>
                                                            <span className="font-medium text-blue-700">Propuesta:</span>
                                                            <span className="text-blue-700">
                                                                {fmtDate(req.adminOptionStartDate)} — {fmtDate(req.adminOptionEndDate)}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>


                                            <div>{statusBadge(req.status)}</div>
                                        </div>


                                        {/* Acciones */}
                                        {/* Acciones (zona inferior) */}
                                        <div className="mt-3 flex w-full items-start gap-2">
                                            {cancelingRequestId === req._id ? (
                                                // Bloque de rechazo con motivo (ocupa todo el ancho)
                                                <div className="w-full rounded-lg border p-3">
                                                    <textarea
                                                        className="w-full resize-none rounded border p-2 text-sm"
                                                        placeholder="Motivo para el trabajador"
                                                        rows={3}
                                                        value={cancelMessage}
                                                        onChange={(e) => setCancelMessage(e.target.value)}
                                                    />
                                                    <div className="mt-2 flex gap-2">
                                                        <button
                                                            className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50"
                                                            disabled={isSendingCancel}
                                                            onClick={() => handleConfirmCancel(req._id)}
                                                        >
                                                            {isSendingCancel ? 'Enviando...' : 'Confirmar rechazo'}
                                                        </button>
                                                        <button
                                                            className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300"
                                                            disabled={isSendingCancel}
                                                            onClick={() => {
                                                                setCancelingRequestId(null);
                                                                setCancelMessage('');
                                                            }}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Lado izquierdo: acciones cuando está pendiente */}
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {req.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
                                                                    onClick={() => handleAccept(req._id)}
                                                                >
                                                                    Aceptar
                                                                </button>
                                                                <button
                                                                    className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                                                                    onClick={() => openAlternative(req)}
                                                                >
                                                                    Opción 2
                                                                </button>
                                                                <button
                                                                    className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                                                                    onClick={() => handleStartCancelFlow(req._id)}
                                                                >
                                                                    Rechazar
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Lado derecho: papelera (solo en aceptadas o rechazadas) */}
                                                    {(req.status === 'accepted' || req.status === 'cancelled') && (
                                                        <div className="ml-auto">
                                                            <button
                                                                onClick={() => handleDelete(req._id)}
                                                                aria-label="Eliminar solicitud"
                                                                title="Eliminar"
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-full
                       bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400
                       focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                            >
                                                                {/* Papelera sólida, nítida */}
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    className="h-4 w-4"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.75"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    aria-hidden="true"
                                                                >
                                                                    {/* Heroicons outline: trash */}
                                                                    <path d="M4 7h16" />
                                                                    <path d="M10 11v6M14 11v6" />
                                                                    <path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
                                                                    <path d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                                                </svg>

                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t p-4">
                        <button
                            onClick={onClose}
                            className="rounded-md border px-4 py-2 hover:bg-gray-50"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de fechas alternativas (reuso del tuyo) */}
            <AlternativeDateModal
                isOpen={isAltOpen}
                onClose={() => setIsAltOpen(false)}
                initialStartDate={altInitialStart}
                initialEndDate={altInitialEnd}
                onSubmit={handleAlternativeSubmit}
            />
        </>
    );
};

export default AdminVacationMonthModal;
