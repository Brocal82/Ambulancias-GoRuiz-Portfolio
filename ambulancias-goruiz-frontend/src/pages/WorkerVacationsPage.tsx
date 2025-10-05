import { useEffect, useMemo, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getUserVacationRequests, respondToAlternativeDate } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import VacationRequestForm from '../components/vacation/VacationRequestForm';
import UserVacationList from '../components/vacation/UserVacationList';
import { useTranslation } from 'react-i18next';
import { toastT } from '../utils/toast';

import AdminVacationMonthGrid from '../components/vacation/AdminVacationMonthGrid';
import { getVacationAvailability, type VacationAvailabilityResponse } from '../api/vacation';
import { monthLabel as fmtMonth } from '../utils/intl';

const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [modalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate] = useState<Date>(new Date());

  const [showForm, setShowForm] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  // ===== Navegación de años para el grid =====
  const [gridYear, setGridYear] = useState<number>(new Date().getFullYear());

  // ===== Modal de disponibilidad mensual (solo lectura) =====
  type DayState = 'green' | 'yellow' | 'red';
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(gridYear);

  const fetchRequests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getUserVacationRequests(token);
      setRequests(data);
      setError('');
      setShowForm(data.length === 0);
    } catch {
      const msgKey = 'toasts.vacations.worker.loadError';
      setError(t(msgKey));
      toastT.error([msgKey]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRespondAlternative = async (id: string, accept: boolean) => {
    if (!token) return;
    try {
      await toastT.promise(respondToAlternativeDate(token, id, { accept }), {
        pending: ['toasts.vacations.worker.respondPending'],
        success: ['toasts.vacations.worker.respondSuccess'],
        error: ['toasts.vacations.worker.error'],
      });
      fetchRequests();
    } catch {}
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    toastT.success(['toasts.vacations.worker.formSuccess']);
    fetchRequests();
    setFormMessage(t('toasts.vacations.worker.formSuccess'));
  };

  // ---- Modal mensual (definido inline, solo visual) ----
  const WorkerAvailabilityMonthModal: React.FC<{
    isOpen: boolean;
    monthIndex: number | null; // 0..11
    year: number;
    onClose: () => void;
  }> = ({ isOpen, monthIndex, year, onClose }) => {
    const locale =
      i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'es-ES';

    const [availability, setAvailability] = useState<VacationAvailabilityResponse | null>(null);
    const [availLoading, setAvailLoading] = useState(false);
    const [availError, setAvailError] = useState<string | null>(null);

    const weekdayHeaders = useMemo(() => {
      const baseMonday = new Date(Date.UTC(2023, 0, 2));
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(baseMonday);
        d.setUTCDate(baseMonday.getUTCDate() + i);
        return d.toLocaleDateString(locale, { weekday: 'short' });
      });
    }, [locale]);

    const calendarCells = useMemo(() => {
      if (monthIndex === null) return Array(42).fill(null);
      const y = year;
      const m0 = monthIndex;
      const first = new Date(y, m0, 1);
      const daysInMonth = new Date(y, m0 + 1, 0).getDate();
      const jsFirstDow = first.getDay();
      const mondayBased = (jsFirstDow + 6) % 7;

      const leading = Array.from({ length: mondayBased }, () => null);
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const base = [...leading, ...days];
      return base.concat(Array.from({ length: Math.max(0, 42 - base.length) }, () => null));
    }, [monthIndex, year]);

    useEffect(() => {
      if (!isOpen || monthIndex === null) return;
      const load = async () => {
        try {
          setAvailLoading(true);
          setAvailError(null);
          const data = await getVacationAvailability({ year, month: monthIndex + 1 });
          setAvailability(data);
        } catch {
          setAvailError('load_error');
        } finally {
          setAvailLoading(false);
        }
      };
      load();
    }, [isOpen, monthIndex, year]);

    const getDayState = (day: number | null): DayState | null => {
      if (!availability || day === null) return null;
      const rec = availability.days.find(d => d.day === day);
      return rec ? rec.state : 'green';
    };

    const monthTitle =
      typeof fmtMonth === 'function' && monthIndex !== null
        ? fmtMonth(year, monthIndex)
        : monthIndex !== null
        ? new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, monthIndex, 1))
        : '';

    if (!isOpen || monthIndex === null) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div
          className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="worker-availability-month-title"
        >
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <h3 id="worker-availability-month-title" className="text-base font-semibold text-slate-900 truncate">
                {monthTitle} · {year}
              </h3>
              <button
                aria-label={t('pages.vacations.monthModal.close')}
                onClick={onClose}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-green-500" />
                {t('common.available', 'Disponible')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-yellow-400" />
                {t('common.requested', 'Solicitado')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-red-500" />
                {t('common.full', 'Completo')}
              </span>
              {availability && (
                <span className="ml-auto text-slate-500">
                  {t('pages.vacations.adminPage.capacity', { count: availability.maxPerDay })}
                </span>
              )}
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
              {weekdayHeaders.map((w, i) => (
                <div key={i} className="py-0.5">{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {availLoading &&
                Array.from({ length: 42 }).map((_, i) => (
                  <div key={`sk-${i}`} className="h-6 sm:h-7 md:h-8 rounded bg-slate-100 animate-pulse" />
                ))}

              {!availLoading &&
                calendarCells.map((cell, idx) => {
                  if (cell === null) {
                    return <div key={`empty-${idx}`} className="h-6 sm:h-7 md:h-8 rounded bg-transparent" />;
                  }
                  const state = getDayState(cell);
                  const color =
                    state === 'red'
                      ? 'bg-red-500 text-white'
                      : state === 'yellow'
                      ? 'bg-yellow-400 text-slate-900'
                      : 'bg-green-500 text-white';
                  return (
                    <div
                      key={`d-${cell}-${idx}`}
                      className={[
                        'h-6 sm:h-7 md:h-8 rounded flex items-center justify-center text-[10px] font-medium select-none',
                        color,
                      ].join(' ')}
                      title={`${cell}`}
                      aria-label={`${cell}`}
                    >
                      {cell}
                    </div>
                  );
                })}
            </div>

            {availError && (
              <p className="mt-1 text-[11px] text-rose-600">
                {t('common.loadError', 'No se pudo cargar la disponibilidad.')}
              </p>
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-end">
            <button
              onClick={onClose}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {t('pages.vacations.monthModal.close')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== Render principal =====
  if (loading) return <p className="p-4 text-sm text-slate-600">{t('pages.vacations.workerPage.loading')}</p>;
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('pages.vacations.workerPage.title')}
          </h2>
        </div>

        {/* Grid de 12 meses con navegación de año integrada */}
        <div className="mb-4">
          <AdminVacationMonthGrid
            requests={requests}
            year={gridYear}
            onYearChange={(y) => setGridYear(y)}
            onMonthOpen={(monthIdx, y) => {
              setSelectedMonthIndex(monthIdx);
              setSelectedYear(y);
              setIsMonthModalOpen(true);
            }}
            // onMonthClick también funciona (compat), pero usamos onMonthOpen para capturar el año
          />
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <button
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm
                ? t('pages.vacations.workerPage.toggleCloseForm')
                : t('pages.vacations.workerPage.toggleOpenForm')}
            </button>
            {formMessage && <p className="text-sm text-emerald-700">{formMessage}</p>}
          </div>

          <div
            className={[
              "mb-4 rounded-xl ring-1 ring-slate-200 p-3 bg-slate-50 transition-all",
              showForm ? "block" : "hidden",
            ].join(" ")}
          >
            {/* Muy importante: NO uses key dinámico aquí */}
            <VacationRequestForm onSuccess={handleFormSuccess} />
          </div>


          {requests.length === 0 && !loading && !showForm && (
            <p className="text-sm text-slate-600">{t('pages.vacations.workerPage.empty')}</p>
          )}

          {requests.length > 0 && (
            <div className="mt-2">
              <UserVacationList requests={requests} onRespondAlternative={handleRespondAlternative} />
            </div>
          )}
        </div>

        <AlternativeDateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialStartDate={modalInitialStartDate}
          initialEndDate={modalInitialEndDate}
          onSubmit={() => setIsModalOpen(false)}
        />
      </div>

      <WorkerAvailabilityMonthModal
        isOpen={isMonthModalOpen}
        monthIndex={selectedMonthIndex}
        year={selectedYear}
        onClose={() => setIsMonthModalOpen(false)}
      />
    </div>
  );
};

export default WorkerVacationsPage;
