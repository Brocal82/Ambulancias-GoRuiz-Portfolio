import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getMyAppointments } from '../api/appointments';
import type { Appointment } from '../types/appointment';
import RequestAppointmentModal from '../components/appointments/RequestAppointmentModal';
import ChooseSlotModal from '../components/appointments/ChooseSlotModal';
import { toast } from 'react-toastify';

export default function WorkerAppointmentsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal "Pedir cita"
  const [openRequest, setOpenRequest] = useState(false);

  // Modal "Elegir hora"
  const [openChoose, setOpenChoose] = useState(false);
  const [chooseId, setChooseId] = useState<string>('');
  const [chooseSlots, setChooseSlots] = useState<{ start: string; end: string }[]>([]);

  const refresh = async () => {
    try {
      const data = await getMyAppointments(token!);
      setItems(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al recargar citas');
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getMyAppointments(token!);
        if (mounted) setItems(data);
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'Error al cargar tus citas');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const nextConfirmed = useMemo(() => {
    return items
      .filter(
        (a) =>
          (a.status === 'confirmed' || a.status === 'rescheduled') &&
          a.selectedSlot?.start
      )
      .sort(
        (x, y) =>
          new Date(x.selectedSlot!.start).getTime() -
          new Date(y.selectedSlot!.start).getTime()
      )[0];
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Mis Citas</h1>

      {/* Próxima cita confirmada */}
      {nextConfirmed && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
          <div className="font-semibold">Próxima cita confirmada</div>
          <div className="text-sm">
            {new Date(nextConfirmed.selectedSlot!.start).toLocaleString('de-DE', {
              timeZone: 'Europe/Berlin',
            })}{' '}
            · {nextConfirmed.reason}
          </div>
        </div>
      )}

      {/* Botón pedir cita */}
      <div className="mb-4">
        <button
          onClick={() => setOpenRequest(true)}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Pedir cita
        </button>
      </div>

      {/* Lista de citas */}
      {loading ? (
        <p>Cargando...</p>
      ) : items.length === 0 ? (
        <p>No tienes citas todavía.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a._id} className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{a.reason}</div>
                  <div className="text-sm text-gray-600">Estado: {a.status}</div>
                  {a.selectedSlot && (
                    <div className="text-sm">
                      Seleccionada:{' '}
                      {new Date(a.selectedSlot.start).toLocaleString('de-DE', {
                        timeZone: 'Europe/Berlin',
                      })}
                    </div>
                  )}
                </div>

                {/* Si está propuesto, permitir elegir */}
                {a.status === 'proposed' && (a.proposedSlots?.length ?? 0) > 0 && (
                  <button
                    className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      setChooseId(a._id);
                      setChooseSlots(a.proposedSlots);
                      setOpenChoose(true);
                    }}
                  >
                    Elegir hora
                  </button>
                )}
              </div>

              {/* Mensaje si aún no hay slots cargados */}
              {a.status === 'proposed' && (a.proposedSlots?.length ?? 0) === 0 && (
                <div className="mt-2 text-sm text-amber-700">
                  Tienes horarios propuestos pendientes (el admin aún no cargó opciones).
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Modal: pedir cita */}
      <RequestAppointmentModal
        isOpen={openRequest}
        onClose={() => setOpenRequest(false)}
        onSuccess={refresh}
      />

      {/* Modal: elegir slot */}
      <ChooseSlotModal
        isOpen={openChoose}
        onClose={() => setOpenChoose(false)}
        appointmentId={chooseId}
        proposedSlots={chooseSlots}
        onSuccess={async () => {
          await refresh();
          setOpenChoose(false);
        }}
      />
    </div>
  );
}
