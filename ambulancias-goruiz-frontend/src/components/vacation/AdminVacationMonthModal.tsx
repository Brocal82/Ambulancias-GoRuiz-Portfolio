import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { filterRequestsByMonth } from '../../utils/vacationMonthUtils';
import { updateVacationRequest, deleteVacationRequest } from '../../api/vacation';
import AlternativeDateModal from './AlternativeDateModal';
import { useAuth } from '../../hooks/useAuth';
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
      alert(t('pages.vacations.workerPage.error'));
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
      alert(t('pages.vacations.workerPage.error'));
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
      alert(t('pages.vacations.workerPage.error'));
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
      alert(t('pages.vacations.workerPage.error'));
    }
  };

  // devolver null tras hooks
  if (!isOpen || monthIndex === null) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />

        <div
          className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vacation-month-modal-title"
        >
          {/* Header */}
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="vacation-month-modal-title" className="text-lg font-semibold">
      {monthLabel} · {year}
    </h3>
              <p className="mt-0.5 text-sm text-gray-600">
                {t('pages.vacations.monthModal.countLine', { count: monthCount })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === '' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
                aria-label={t('pages.vacations.monthModal.filters.all')}
              >
                {t('pages.vacations.monthModal.filters.all')}
                {monthCount > 0 ? ` (${monthCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'pending' ? 'bg-yellow-500 text-white border-yellow-500' : 'hover:bg-yellow-50 border-yellow-300 text-yellow-700'}`}
                aria-label={t('pages.vacations.monthModal.filters.pending')}
              >
                {t('pages.vacations.monthModal.filters.pending')}
                {statusCounts.pending ? ` (${statusCounts.pending})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('accepted')}
                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'accepted' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-green-50 border-green-300 text-green-700'}`}
                aria-label={t('pages.vacations.monthModal.filters.accepted')}
              >
                {t('pages.vacations.monthModal.filters.accepted')}
                {statusCounts.accepted ? ` (${statusCounts.accepted})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('cancelled')}
                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'cancelled' ? 'bg-red-600 text-white border-red-600' : 'hover:bg-red-50 border-red-300 text-red-700'}`}
                aria-label={t('pages.vacations.monthModal.filters.cancelled')}
              >
                {t('pages.vacations.monthModal.filters.cancelled')}
                {statusCounts.cancelled ? ` (${statusCounts.cancelled})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('option_sent')}
                className={`rounded-full border px-3 py-1 text-xs ${statusFilter === 'option_sent' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-blue-50 border-blue-300 text-blue-700'}`}
                aria-label={t('pages.vacations.monthModal.filters.option_sent')}
              >
                {t('pages.vacations.monthModal.filters.option_sent')}
                {statusCounts.option_sent ? ` (${statusCounts.option_sent})` : ''}
              </button>

              <button
                ref={closeBtnRef}
                aria-label={t('pages.vacations.monthModal.close')}
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
                  className="w-full rounded-md border px-3 py-2 text-sm sm:w-64"
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
                  className="rounded-md border px-3 py-2 text-sm"
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
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            >
              {t('pages.vacations.monthModal.filters.sortToggle', {
                dir: sortAsc ? t('pages.vacations.monthModal.filters.asc') : t('pages.vacations.monthModal.filters.desc')
              })}
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-500">{t('pages.vacations.monthModal.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((req) => (
                  <li key={req._id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {req.user ? `${req.user.lastName}, ${req.user.name}` : '—'}
                        </div>

                        <div className="mt-0.5 text-sm grid grid-cols-[auto,1fr] gap-x-2">
                          <span className="font-medium text-gray-700">{t('pages.vacations.adminPage.badges.requested')}</span>
                          <span className="text-gray-600">
                            {fmtDate(req.startDate)} — {fmtDate(req.endDate)}
                          </span>

                          {req.adminOptionStartDate && req.adminOptionEndDate && (
                            <>
                              <span className="font-medium text-blue-700">{t('pages.vacations.adminPage.badges.proposal')}</span>
                              <span className="text-blue-700">
                                {fmtDate(req.adminOptionStartDate)} — {fmtDate(req.adminOptionEndDate)}
                              </span>
                            </>
                          )}
                        </div>

                        {req.adminNote && (
                          <p className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">{t('pages.vacations.adminPage.badges.note')}</span> {req.adminNote}
                          </p>
                        )}
                      </div>

                      <div>{statusBadge(req.status)}</div>
                    </div>

                    {/* Acciones */}
                    <div className="mt-3 flex w-full items-start gap-2">
                      {cancelingRequestId === req._id ? (
                        <div className="w-full rounded-lg border p-3">
                          <textarea
                            className="w-full resize-none rounded border p-2 text-sm"
                            placeholder={t('pages.vacations.adminPage.actions.cancelMessagePlaceholder')}
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
                              {isSendingCancel ? t('pages.vacations.adminPage.actions.sending') : t('pages.vacations.adminPage.actions.confirmRejection')}
                            </button>
                            <button
                              className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300"
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
                          <div className="flex flex-wrap items-center gap-2">
                            {req.status === 'pending' && (
                              <>
                                <button
                                  className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
                                  onClick={() => handleAccept(req._id)}
                                >
                                  {t('pages.vacations.adminPage.actions.accept')}
                                </button>
                                <button
                                  className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                                  onClick={() => openAlternative(req)}
                                >
                                  {t('pages.vacations.adminPage.actions.altOption')}
                                </button>
                                <button
                                  className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                                  onClick={() => handleStartCancelFlow(req._id)}
                                >
                                  {t('pages.vacations.adminPage.actions.cancel')}
                                </button>
                              </>
                            )}
                          </div>

                          {(req.status === 'accepted' || req.status === 'cancelled') && (
                            <div className="ml-auto">
                              <button
                                onClick={() => handleDelete(req._id)}
                                aria-label={t('pages.vacations.adminPage.actions.delete')}
                                title={t('pages.vacations.adminPage.actions.delete')}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full
                                  bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition
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
          <div className="flex items-center justify-end gap-2 border-t p-4">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 hover:bg-gray-50"
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
