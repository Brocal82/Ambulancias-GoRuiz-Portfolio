import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getPendingAppointments,
  getCalendarAppointments,
} from '../api/appointments';
import type { Appointment } from '../types/appointment';
import { toastT } from "../utils/toast";
import { useTranslation } from 'react-i18next';

// Componentes ya creados
import AdminProposeSlotsModal from '../components/appointments/AdminProposeSlotsModal';
import AdminAppointmentMonthGrid from '../components/appointments/AdminAppointmentMonthGrid';
import AdminMonthCalendar from '../components/appointments/AdminMonthCalendar';
import AdminAppointmentDetail from '../components/appointments/AdminAppointmentDetail';

// Utils locales
const formatRange = (startISO?: string, endISO?: string) => {
  if (!startISO || !endISO) return '';
  const start = new Date(startISO);
  const end = new Date(endISO);
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}.${start.getFullYear()}`;
  const hs = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const he = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  return `${d} ${hs}–${he}`;
};

export default function AdminAppointmentsPage() {
  const { token } = useAuth();
  const { t } = useTranslation('common');

  // --- helpers ---
  const statusLabel = (s: Appointment['status']) =>
    t(`pages.appointments.statusLabel.${s}`);

  // Badge de estado con colores suaves
  const statusBadgeClasses = (s: Appointment['status']) => {
    switch (s) {
      case 'pending':
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
      case 'proposed':
        return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
      case 'confirmed':
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
      case 'rescheduled':
        return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
      case 'cancelled':
        return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
      default:
        return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
    }
  };

  // --- Estado de pendientes ---
  const [pending, setPending] = useState<Appointment[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // --- Estado de confirmadas/reprogramadas del año ---
  const [confirmedYear, setConfirmedYear] = useState<Appointment[]>([]);
  const [loadingConfirmed, setLoadingConfirmed] = useState(true);

  // --- Modal para proponer ---
  const [openPropose, setOpenPropose] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- Modal de detalle (también para ver motivo desde pendientes) ---
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Appointment | null>(null);

  // --- Año actual y mes seleccionado ---
  const year = useMemo(() => new Date().getFullYear(), []);
  const currentMonthIndex = useMemo(() => new Date().getMonth(), []);
  // CAMBIO #2: no renderizar calendario por defecto
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // --- Rango de TODO el año ---
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

  // --- Refrescos ---
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

  // --- Helper: actualizar o añadir en la lista de pendientes
  const upsertPending = (next: Appointment) => {
    setPending((prev) => {
      const idx = prev.findIndex((p) => p._id === next._id);

      // si ya teníamos la cita en la lista y con worker populado, lo preservamos
      if (idx !== -1) {
        const old = prev[idx];
        const merged: Appointment = {
          ...next,
          workerId:
            typeof next.workerId === 'string' ? old.workerId : next.workerId,
        };
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      }

      // si no estaba, lo añadimos tal cual
      return [next, ...prev];
    });
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
                onMonthClick={(mi) => {
                  setSelectedMonth((prev) => (prev === mi ? null : mi));
                }}
                highlightCurrentMonth
                currentMonthIndex={currentMonthIndex}
              />

            )}
          </section>

          {/* 2) Calendario del mes seleccionado (solo tras click) */}
          <section className="mb-8">
            {loadingConfirmed ? (
              <p className="text-sm text-gray-600">
                {t('pages.appointments.status.loadingMonth')}
              </p>
            ) : selectedMonth === null ? null : (
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
                  // intentamos leer posibles slots propuestos si existen
                  const proposedSlots = (a as any)?.proposedSlots as Array<{ id?: string; start?: string; end?: string; }> | undefined;

                  return (
                    <li
                      key={a._id}
                      className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setDetailItem(a);
                        setDetailOpen(true);
                      }}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-900 font-medium line-clamp-2">
                                {a.reason}
                              </span>
                              {/* Badge de estado con colores suaves */}
                              <span
                                className={`px-2 py-1 text-xs rounded-md ${statusBadgeClasses(
                                  a.status
                                )}`}
                              >
                                {statusLabel(a.status)}
                              </span>
                            </div>

                            <div className="mt-1 text-sm text-slate-600">
                              {t('pages.appointments.labels.worker')}{' '}
                              {worker
                                ? `${worker.lastName}, ${worker.name}`
                                : `ID: ${typeof a.workerId === 'string' ? a.workerId : ''}`}
                            </div>
                          </div>

                          {/* Botón de proponer solo si está pendiente */}
                          {a.status === 'pending' && (
                            <div className="shrink-0 flex items-center gap-2">
                              <button
                                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                                onClick={(e) => {
                                  e.stopPropagation(); // 👈 evita que se dispare también el detalle
                                  setSelectedId(a._id);
                                  setOpenPropose(true);
                                }}
                              >
                                {t('pages.appointments.actions.proposeSlots')}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Listar horarios propuestos (visibles hasta confirmación) */}
                        {!!proposedSlots?.length && (
                          <div className="mt-1">
                            <div className="text-xs uppercase text-slate-500">
                              {t('pages.appointments.labels.proposedSlots')}
                            </div>
                            <ul className="mt-1 space-y-1">
                              {proposedSlots.map((s, idx) => (
                                <li key={s.id ?? idx} className="text-sm text-slate-700">
                                  {formatRange(s.start, s.end)}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-1 text-xs text-slate-500">
                              {t('pages.appointments.hints.visibleUntilConfirmation')}
                            </p>
                          </div>
                        )}
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
            onSuccess={async (updated) => {
              // 👇 mantenemos la cita en la lista local de pendientes con estado 'proposed'
              upsertPending(updated);

              // 👇 refrescamos solo confirmadas (el calendario)
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
