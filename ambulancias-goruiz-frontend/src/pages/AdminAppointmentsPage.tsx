import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getPendingAppointments,
  getCalendarAppointments,
} from '../api/appointments';
import type { Appointment } from '../types/appointment';
import { toastT } from "../utils/toast";
import { useTranslation } from 'react-i18next';

// Componentes ya creados en pasos anteriores
import AdminProposeSlotsModal from '../components/appointments/AdminProposeSlotsModal';
// Nuevos componentes del calendario
import AdminAppointmentMonthGrid from '../components/appointments/AdminAppointmentMonthGrid';
import AdminMonthCalendar from '../components/appointments/AdminMonthCalendar';
import AdminAppointmentDetail from '../components/appointments/AdminAppointmentDetail';

export default function AdminAppointmentsPage() {
  const { token } = useAuth();
  const { t } = useTranslation('common');

  // --- helpers ---
  const statusLabel = (s: Appointment['status']) =>
    t(`pages.appointments.statusLabel.${s}`);

  // --- Estado de pendientes ---
  const [pending, setPending] = useState<Appointment[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // --- Estado de confirmadas/reprogramadas del año ---
  const [confirmedYear, setConfirmedYear] = useState<Appointment[]>([]);
  const [loadingConfirmed, setLoadingConfirmed] = useState(true);

  // --- Modal para proponer ---
  const [openPropose, setOpenPropose] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Appointment | null>(null);

  // --- Año y mes seleccionados ---
  const year = useMemo(() => new Date().getFullYear(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  // --- Rango de TODO el año para cargar confirmadas/reprogramadas ---
  const { fromISO, toISO } = useMemo(() => {
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }, [year]);

  // --- Cargas iniciales ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          getPendingAppointments(token!),
          getCalendarAppointments(fromISO, toISO, token!),
        ]);
        if (mounted) {
          setPending(p);
          setConfirmedYear(c);
        }
      } catch (e: any) {
        toastT.error(e?.response?.data?.message ?? ["toasts.appointments.loadError"]);
      } finally {
        if (mounted) {
          setLoadingPending(false);
          setLoadingConfirmed(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [token, fromISO, toISO]);

  // --- Refrescos manuales ---
  const refreshPending = async () => {
    setLoadingPending(true);
    try {
      const p = await getPendingAppointments(token!);
      setPending(p);
    } catch (e: any) {
      toastT.error(e?.response?.data?.message ?? ["toasts.appointments.reloadPendingError"]);
    } finally {
      setLoadingPending(false);
    }
  };

  const refreshConfirmed = async () => {
    setLoadingConfirmed(true);
    try {
      const c = await getCalendarAppointments(fromISO, toISO, token!);
      setConfirmedYear(c);
    } catch (e: any) {
      toastT.error(e?.response?.data?.message ?? ["toasts.appointments.reloadConfirmedError"]);
    } finally {
      setLoadingConfirmed(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshPending(), refreshConfirmed()]);
  };

return (
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('pages.appointments.admin.title')}
          </h1>
          <button
            onClick={refreshAll}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            {t('pages.appointments.actions.refresh')}
          </button>
        </div>

        {/* 1) Grid de 12 meses */}
        <section className="mb-6">
          {loadingConfirmed ? (
            <p className="text-sm text-gray-600">{t('pages.appointments.status.loadingYear')}</p>
          ) : (
            <AdminAppointmentMonthGrid
              items={confirmedYear}
              year={year}
              onMonthClick={(mi) => setSelectedMonth(mi)}
            />
          )}
        </section>

        {/* 2) Calendario del mes seleccionado */}
        <section className="mb-8">
          {loadingConfirmed ? (
            <p className="text-sm text-gray-600">{t('pages.appointments.status.loadingMonth')}</p>
          ) : (
            <AdminMonthCalendar
              items={confirmedYear}
              year={year}
              monthIndex={selectedMonth}
              onAppointmentClick={(a) => {
                setDetailItem(a);
                setDetailOpen(true);
              }}
            />
          )}
        </section>

        {/* 3) Bloque de Pendientes (proponer horarios) */}
        <section className="mt-8 pt-6 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            {t('pages.appointments.pending.title')}
          </h2>

          {loadingPending ? (
            <p className="text-sm text-gray-600">{t('pages.appointments.status.loading')}</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-600">{t('pages.appointments.pending.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((a) => {
                const worker = typeof a.workerId === 'object' ? a.workerId : null;
                return (
                  <li
                    key={a._id}
                    className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-slate-900 font-medium">{a.reason}</div>
                        <div className="mt-0.5 text-sm text-slate-600">
                          {t('pages.appointments.labels.worker')}{' '}
                          {worker
                            ? `${worker.lastName}, ${worker.name}`
                            : `ID: ${typeof a.workerId === 'string' ? a.workerId : ''}`}
                        </div>
                        <div className="text-sm text-slate-600">
                          {t('pages.appointments.labels.status')}: {statusLabel(a.status)}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                          onClick={() => {
                            setSelectedId(a._id);
                            setOpenPropose(true);
                          }}
                        >
                          {t('pages.appointments.actions.proposeSlots')}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Modal: Proponer 1–3 horarios */}
        <AdminProposeSlotsModal
          isOpen={openPropose}
          appointmentId={selectedId || ''}
          onClose={() => {
            setOpenPropose(false);
            setSelectedId(null);
          }}
          onSuccess={async () => {
            await refreshPending();
            await refreshConfirmed();
          }}
          defaultDurationMinutes={30}
        />

        {/* Modal: Detalle de cita */}
        <AdminAppointmentDetail
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          item={detailItem}
          onChanged={async () => {
            await Promise.all([refreshConfirmed(), refreshPending()]);
          }}
        />
      </div>
    </div>
  </div>
);


}
