import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getPendingAppointments,
  getCalendarAppointments,
} from '../api/appointments';
import type { Appointment } from '../types/appointment';
import { toast } from 'react-toastify';

// Componentes ya creados en pasos anteriores
import AdminProposeSlotsModal from '../components/appointments/AdminProposeSlotsModal';
// Nuevos componentes del calendario
import AdminAppointmentMonthGrid from '../components/appointments/AdminAppointmentMonthGrid';
import AdminMonthCalendar from '../components/appointments/AdminMonthCalendar';
import AdminAppointmentDetail from '../components/appointments/AdminAppointmentDetail';


export default function AdminAppointmentsPage() {
  const { token } = useAuth();

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
        toast.error(e?.response?.data?.message ?? 'Error al cargar citas');
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
      toast.error(e?.response?.data?.message ?? 'Error al recargar pendientes');
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
      toast.error(e?.response?.data?.message ?? 'Error al recargar confirmadas');
    } finally {
      setLoadingConfirmed(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshPending(), refreshConfirmed()]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold mb-4">Citas (Admin)</h1>
          <button
            onClick={refreshAll}
            className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
          >
            Refrescar
          </button>
        </div>

        {/* 1) Cuadrícula de 12 meses */}
        <section>
          {loadingConfirmed ? (
            <p>Cargando calendario anual...</p>
          ) : (
            <AdminAppointmentMonthGrid
              items={confirmedYear}
              year={year}
              onMonthClick={(mi) => setSelectedMonth(mi)}
            />
          )}
        </section>

        {/* 2) Calendario del mes seleccionado */}
        <section>
          {loadingConfirmed ? (
            <p>Cargando mes...</p>
          ) : (
            <AdminMonthCalendar
              items={confirmedYear}
              year={year}
              monthIndex={selectedMonth}
              onAppointmentClick={(a) => { setDetailItem(a); setDetailOpen(true); }}
            // onAppointmentClick={(a) => { /* Paso siguiente: abrir detalle */ }}
            />
          )}
        </section>

        {/* 3) Bloque de Pendientes (para proponer horarios) */}
        <section className="mt-10 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold mb-2">Pendientes</h2>
          {loadingPending ? (
            <p>Cargando...</p>
          ) : pending.length === 0 ? (
            <p>No hay solicitudes pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((a) => {
                const worker = typeof a.workerId === 'object' ? a.workerId : null;
                return (
                  <li key={a._id} className="bg-white p-4 rounded shadow">
                    <div className="font-semibold">{a.reason}</div>
                    <div className="text-sm text-gray-600">
                      Trabajador:{' '}
                      {worker
                        ? `${worker.lastName}, ${worker.name}`
                        : `ID: ${typeof a.workerId === 'string' ? a.workerId : ''}`}
                    </div>
                    <div className="text-sm text-gray-600">Estado: {a.status}</div>

                    <button
                      className="mt-2 px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => { setSelectedId(a._id); setOpenPropose(true); }}
                    >
                      Proponer horarios
                    </button>
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
          onClose={() => { setOpenPropose(false); setSelectedId(null); }}
          onSuccess={async () => { await refreshPending(); await refreshConfirmed(); }}
          defaultDurationMinutes={30}
        />

        <AdminAppointmentDetail
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          item={detailItem}
          onChanged={async () => {
            // Al cancelar, refrescamos confirmadas (y pendientes por si afectan)
            await Promise.all([refreshConfirmed(), refreshPending()]);
          }}
        />

      </div>
    </div>
  );
}
