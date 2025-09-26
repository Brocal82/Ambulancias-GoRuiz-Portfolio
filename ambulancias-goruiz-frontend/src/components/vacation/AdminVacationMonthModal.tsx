import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { filterRequestsByMonth } from '../../utils/vacationMonthUtils';
import { updateVacationRequest, deleteVacationRequest } from '../../api/vacation';
import AlternativeDateModal from './AlternativeDateModal';
import { useAuth } from '../../hooks/useAuth';
import { toastT } from "../../utils/toast";
import { useTranslation } from 'react-i18next';
import { monthLabel as fmtMonth } from '../../utils/intl';

type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';

interface Props {
  isOpen: boolean;
  monthIndex: number | null; // 0..11
  requests: IVacationRequest[];
  year?: number;
  onClose: () => void;
  onActionDone?: () => void;
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
  const { t, i18n } = useTranslation();
  const locale =
    i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'es-ES';

  // filtros/orden
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | VacationStatus>('');
  const [sortAsc, setSortAsc] = useState(true);

  // cancelar con motivo
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');
  const [isSendingCancel, setIsSendingCancel] = useState(false);

  // opción alternativa
  const [isAltOpen, setIsAltOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [altInitialStart, setAltInitialStart] = useState<Date>(new Date());
  const [altInitialEnd, setAltInitialEnd] = useState<Date>(new Date());

  // a11y
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // etiqueta del mes
  const monthLabel = useMemo(() => {
    if (monthIndex === null) return '';
    return fmtMonth(year, monthIndex);
  }, [monthIndex, year]);

  // requests del mes
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

  // aplicar filtros/orden
  const filtered = useMemo(() => {
    let items = monthRequests;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      items = items.filter(r => {
        const name = `${r.user?.name ?? ''} ${r.user?.lastName ?? ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    if (statusFilter) items = items.filter(r => r.status === statusFilter);
    items = [...items].sort((a, b) => {
      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      return sortAsc ? aStart - bStart : bStart - aStart;
    });
    return items;
  }, [monthRequests, searchText, statusFilter, sortAsc]);

  // helpers
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { timeZone: 'Europe/Berlin' });

  const statusBadge = (status: VacationStatus) => {
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
    switch (status) {
      case 'accepted':
        return <span className={`${base} bg-green-100 text-green-700`}>{t('pages.vacations.monthModal.filters.accepted')}</span>;
      case 'cancelled':
        return <span className={`${base} bg-red-100 text-red-700`}>{t('pages.vacations.monthModal.filters.cancelled')}</span>;
      case 'option_sent':
        return <span className={`${base} bg-blue-100 text-blue-700`}>{t('pages.vacations.monthModal.filters.option_sent')}</span>;
      default:
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>{t('pages.vacations.monthModal.filters.pending')}</span>;
    }
  };

  // acciones
  const handleAccept = async (id: string) => {
    if (!token) return;
    try {
      await updateVacationRequest(token, id, { status: 'accepted' });
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
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
      toastT.error(["toasts.vacations.worker.loadError"]);
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
      await updateVacationRequest(token, id, { status: 'cancelled', adminNote: cancelMessage });
      setCancelingRequestId(null);
      setCancelMessage('');
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    } finally {
      setIsSendingCancel(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t('pages.vacations.monthModal.confirmDelete'))) return;
    try {
      await deleteVacationRequest(token, id);
      onActionDone?.();
    } catch {
      toastT.error(["toasts.vacations.worker.error"]);
    }
  };

  // devolver null tras hooks
  if (!isOpen || monthIndex === null) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div
          className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vacation-month-modal-title"
        >
          {/* Header */}
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="vacation-month-modal-title" className="text-lg font-semibold text-slate-900">
                {monthLabel} · {year}
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                {t('pages.vacations.monthModal.countLine', { count: monthCount })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`rounded-full px-3 py-1 text-xs ring-1 ring-slate-300 ${statusFilter === ''
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                  } focus:outline-none focus:ring-4 focus:ring-blue-100`}
                aria-label={t('pages.vacations.monthModal.filters.all')}
              >
                {t('pages.vacations.monthModal.filters.all')}
                {monthCount > 0 ? ` (${monthCount})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${statusFilter === 'pending'
                    ? 'bg-amber-500 text-white ring-amber-500'
                    : 'bg-white text-amber-700 ring-amber-300 hover:bg-amber-50'
                  } focus:outline-none focus:ring-4 focus:ring-amber-100`}
                aria-label={t('pages.vacations.monthModal.filters.pending')}
              >
                {t('pages.vacations.monthModal.filters.pending')}
                {statusCounts.pending ? ` (${statusCounts.pending})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('accepted')}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${statusFilter === 'accepted'
                    ? 'bg-emerald-600 text-white ring-emerald-600'
                    : 'bg-white text-emerald-700 ring-emerald-300 hover:bg-emerald-50'
                  } focus:outline-none focus:ring-4 focus:ring-emerald-100`}
                aria-label={t('pages.vacations.monthModal.filters.accepted')}
              >
                {t('pages.vacations.monthModal.filters.accepted')}
                {statusCounts.accepted ? ` (${statusCounts.accepted})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('cancelled')}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${statusFilter === 'cancelled'
                    ? 'bg-rose-600 text-white ring-rose-600'
                    : 'bg-white text-rose-700 ring-rose-300 hover:bg-rose-50'
                  } focus:outline-none focus:ring-4 focus:ring-rose-100`}
                aria-label={t('pages.vacations.monthModal.filters.cancelled')}
              >
                {t('pages.vacations.monthModal.filters.cancelled')}
                {statusCounts.cancelled ? ` (${statusCounts.cancelled})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('option_sent')}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${statusFilter === 'option_sent'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-blue-700 ring-blue-300 hover:bg-blue-50'
                  } focus:outline-none focus:ring-4 focus:ring-blue-100`}
                aria-label={t('pages.vacations.monthModal.filters.option_sent')}
              >
                {t('pages.vacations.monthModal.filters.option_sent')}
                {statusCounts.option_sent ? ` (${statusCounts.option_sent})` : ''}
              </button>

              <button
                ref={closeBtnRef}
                aria-label={t('pages.vacations.monthModal.close')}
                onClick={onClose}
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <div className="flex flex-col">
                <label htmlFor="vacation-filter-user" className="sr-only">
                  {t('pages.vacations.monthModal.filters.userPlaceholder')}
                </label>
                <input
                  id="vacation-filter-user"
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t('pages.vacations.monthModal.filters.userPlaceholder')}
                  aria-label={t('pages.vacations.monthModal.filters.userPlaceholder')}
                  className="w-full sm:w-64 rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="vacation-filter-status" className="sr-only">
                  {t('pages.vacations.monthModal.filters.statusLabel')}
                </label>
                <select
                  id="vacation-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label={t('pages.vacations.monthModal.filters.statusLabel')}
                  className="rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">{t('pages.vacations.monthModal.filters.all')}</option>
                  <option value="pending">{t('pages.vacations.monthModal.filters.pending')}</option>
                  <option value="accepted">{t('pages.vacations.monthModal.filters.accepted')}</option>
                  <option value="cancelled">{t('pages.vacations.monthModal.filters.cancelled')}</option>
                  <option value="option_sent">{t('pages.vacations.monthModal.filters.option_sent')}</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setSortAsc((v) => !v)}
              aria-label={t('pages.vacations.monthModal.filters.sortToggle', {
                dir: sortAsc ? t('pages.vacations.monthModal.filters.asc') : t('pages.vacations.monthModal.filters.desc')
              })}
              className="rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              {t('pages.vacations.monthModal.filters.sortToggle', {
                dir: sortAsc ? t('pages.vacations.monthModal.filters.asc') : t('pages.vacations.monthModal.filters.desc')
              })}
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-500">{t('pages.vacations.monthModal.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((req) => (
                  <li key={req._id} className="rounded-lg ring-1 ring-slate-200 p-2 hover:bg-slate-50 transition">
                    {/* Fila superior */}
                    <div className="flex items-start justify-between gap-2">
                      {/* Info trabajador + fechas */}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-sm leading-snug">
                          {req.user ? `${req.user.lastName}, ${req.user.name}` : '—'}
                        </div>

                        <div className="mt-0.5 text-xs leading-snug grid grid-cols-[auto,1fr] gap-x-2">
                          <span className="font-medium text-slate-700">
                            {t('pages.vacations.adminPage.badges.requested')}
                          </span>
                          <span className="text-slate-700">
                            {fmtDate(req.startDate)} — {fmtDate(req.endDate)}
                          </span>

                          {req.adminOptionStartDate && req.adminOptionEndDate && (
                            <>
                              <span className="font-medium text-blue-700">
                                {t('pages.vacations.adminPage.badges.proposal')}
                              </span>
                              <span className="text-blue-700">
                                {fmtDate(req.adminOptionStartDate)} — {fmtDate(req.adminOptionEndDate)}
                              </span>
                            </>
                          )}
                        </div>

                        {req.adminNote && (
                          <p className="mt-1 text-xs leading-snug text-slate-600">
                            <span className="font-medium">{t('pages.vacations.adminPage.badges.note')}</span>{' '}
                            {req.adminNote}
                          </p>
                        )}
                      </div>

                      {/* Status en la esquina superior derecha */}
                      <div className="shrink-0">{statusBadge(req.status)}</div>
                    </div>

                    {/* Acciones + papelera abajo */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {cancelingRequestId === req._id ? (
                        <div className="w-full rounded-lg ring-1 ring-slate-200 p-2 bg-white">
                          <textarea
                            className="w-full resize-none rounded-lg border border-slate-300 ring-1 ring-slate-200 p-2 text-xs leading-snug focus:outline-none focus:ring-4 focus:ring-rose-100"
                            placeholder={t('pages.vacations.adminPage.actions.cancelMessagePlaceholder')}
                            rows={3}
                            value={cancelMessage}
                            onChange={(e) => setCancelMessage(e.target.value)}
                          />
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-50"
                              disabled={isSendingCancel}
                              onClick={() => handleConfirmCancel(req._id)}
                            >
                              {isSendingCancel
                                ? t('pages.vacations.adminPage.actions.sending')
                                : t('pages.vacations.adminPage.actions.confirmRejection')}
                            </button>
                            <button
                              className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50"
                              disabled={isSendingCancel}
                              onClick={() => {
                                setCancelingRequestId(null);
                                setCancelMessage('');
                              }}
                            >
                              {t('pages.vacations.adminPage.actions.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {req.status === 'pending' && (
                            <>
                              <button
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                onClick={() => handleAccept(req._id)}
                              >
                                {t('pages.vacations.adminPage.actions.accept')}
                              </button>
                              <button
                                className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                onClick={() => openAlternative(req)}
                              >
                                {t('pages.vacations.adminPage.actions.altOption')}
                              </button>
                              <button
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100"
                                onClick={() => handleStartCancelFlow(req._id)}
                              >
                                {t('pages.vacations.adminPage.actions.cancel')}
                              </button>
                            </>
                          )}

                          {(req.status === 'accepted' || req.status === 'cancelled') && (
                            <div className="ml-auto">
                              <button
                                onClick={() => handleDelete(req._id)}
                                aria-label={t('pages.vacations.adminPage.actions.delete')}
                                title={t('pages.vacations.adminPage.actions.delete')}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full
                                  bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition
                                  focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400
                                  focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                              >
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
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
            <button
              onClick={onClose}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              {t('pages.vacations.monthModal.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de fechas alternativas */}
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

