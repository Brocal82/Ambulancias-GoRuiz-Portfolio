// frontend/src/pages/AdminVacationsPage.tsx
import { useEffect, useState, useCallback } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests, updateVacationRequest, invalidateAvailabilityByRange, getVacationAvailability } from '../api/vacation';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import AdminVacationMonthGrid from '../components/vacation/AdminVacationMonthGrid';
import AdminVacationMonthModal from '../components/vacation/AdminVacationMonthModal';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from '../utils/toast';
import StatusBadge from '../components/common/StatusBadge';

// Nombre del evento global para refrescar el badge del Dashboard
const ADMIN_VACATIONS_CHANGED_EVENT = 'admin-vacations-changed';
const notifyVacationsChanged = () => window.dispatchEvent(new Event(ADMIN_VACATIONS_CHANGED_EVENT));

// ✅ Helper mínimo para sincronizar Worker sin recargar (incluye fallback por storage)
function emitVacationSync(payload: { id: string; status: 'accepted' | 'cancelled' | 'deleted'; ts?: number }) {
  const detail = { ts: Date.now(), ...payload };

  // Misma pestaña
  try {
    window.dispatchEvent(new CustomEvent('vacation-requests-updated', { detail }));
  } catch {}

  // Otras pestañas/ventanas (canal dedicado)
  try {
    const bc = new BroadcastChannel('vacations');
    bc.postMessage({ type: 'requests-updated', ...detail });
    bc.close?.();
  } catch {}

  // 🔁 Fallback universal: dispara evento 'storage' en otras pestañas
  try {
    localStorage.setItem('__vac_req_upd__', JSON.stringify(detail));
    setTimeout(() => {
      try { localStorage.removeItem('__vac_req_upd__'); } catch {}
    }, 500);
  } catch {}
}


const AdminVacationRequests = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ====== Estado del grid de meses (con año navegable) ======
  const [gridYear, setGridYear] = useState<number>(new Date().getFullYear());

  // ====== Estado del modal del mes (abrir con mes + año correctos) ======
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(gridYear);

  // 🔄 Forzar refresco del grid cuando cambie la disponibilidad sin recargar
const [gridRefreshTick, setGridRefreshTick] = useState(0);

// Refresca caché del mes concreto y fuerza rerender del grid
const forceRefreshMonth = useCallback(async (y: number, m1: number) => {
  try {
    await getVacationAvailability({ year: y, month: m1 }, { force: true });
  } catch {}
  setGridRefreshTick((n) => n + 1);
}, []);


  // ====== Estado para AlternativeDateModal existente ======
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [modalInitialStartDate, setModalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate, setModalInitialEndDate] = useState<Date>(new Date());
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');
  const [isSendingCancel, setIsSendingCancel] = useState(false);

  const locale =
    i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'es-ES';

  const fetchRequests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getVacationRequests(token);
      setRequests(data);
      setError('');
    } catch {
      const msgKey = 'toasts.vacations.admin.loadError';
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

  // 🔔 NUEVO: escuchar “request creada/actualizada” desde cualquier pestaña y refrescar lista
  useEffect(() => {
    const onCustom = () => fetchRequests();
    window.addEventListener('vacation-requests-updated', onCustom as EventListener);

    // BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      const BC = (window as any).BroadcastChannel as
        | (new (name: string) => BroadcastChannel)
        | undefined;
      if (typeof BC === 'function') {
        bc = new BC('vacations');
        bc.onmessage = (msg: MessageEvent) => {
          const data = msg.data || {};
          if (data?.type === 'requests-updated') {
            fetchRequests();
          }
        };
      }
    } catch {}

    // Fallback: storage
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === '__vac_req_upd__' && ev.newValue) {
        fetchRequests();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('vacation-requests-updated', onCustom as EventListener);
      window.removeEventListener('storage', onStorage);
      try { bc?.close?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live update del GRID (colores) — escucha invalidaciones de disponibilidad
useEffect(() => {
  const schedule = (y: number, m1: number) => {
    // Refresca la caché del mes invalidado y fuerza rerender del grid
    forceRefreshMonth(y, m1);
  };

  // Misma pestaña (CustomEvent)
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail as { year?: number; month?: number };
    if (detail?.year && detail?.month) schedule(detail.year, detail.month);
  };
  window.addEventListener('vacation-availability-invalidated', onCustom as EventListener);

  // BroadcastChannel entre pestañas/ventanas
  let bc: BroadcastChannel | null = null;
  try {
    const BC = (window as any).BroadcastChannel as
      | (new (name: string) => BroadcastChannel)
      | undefined;
    if (typeof BC === 'function') {
      bc = new BC('vacations');
      bc.onmessage = (msg: MessageEvent) => {
        const data = msg.data || {};
        if (data?.type === 'availability-invalidated' && data.year && data.month) {
          schedule(data.year, data.month);
        }
      };
    }
  } catch {}

  // Fallback universal: evento 'storage'
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== '__vac_av_inval__' || !ev.newValue) return;
    try {
      const payload = JSON.parse(ev.newValue);
      if (payload?.year && payload?.month) schedule(payload.year, payload.month);
    } catch {}
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('vacation-availability-invalidated', onCustom as EventListener);
    window.removeEventListener('storage', onStorage);
    try { bc?.close?.(); } catch {}
  };
}, [forceRefreshMonth]);

  

  type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';

  // Mostrar solo las solicitudes que requieren acción (pendientes u opción enviada)
  const actionableRequests = requests.filter(
    (r) => r.status === 'pending' || r.status === 'option_sent'
  );

const handleUpdateStatus = async (id: string, status: VacationStatus) => {
  if (!token) return;

  // Para 'accepted' hacemos manejo manual para interceptar 409 (capacidad)
  if (status === 'accepted') {
    try {
      await updateVacationRequest(token, id, { status });

      // 🟢 Invalidar disponibilidad en vivo (cambia capacidad)
      const req = requests.find(r => r._id === id);
      if (req) {
        invalidateAvailabilityByRange(req.startDate, req.endDate);
      }

      // 🔔 Sync Worker y Dashboard
      emitVacationSync({ id, status: 'accepted' });
      notifyVacationsChanged();

      // ✅ Toast de éxito + refresco
      toastT.success(['toasts.vacations.admin.accepted']);
      fetchRequests();
    } catch (e: any) {
      // Capacidad excedida (bloquear tercer aceptado)
      if (e?.status === 409 && e?.body?.code === 'capacity_exceeded') {
        toastT.error(['toasts.vacations.admin.capacityExceeded']);
        return;
      }
      // Otros errores
      toastT.error(['toasts.vacations.admin.error']);
    }
    return;
  }

  // Para 'cancelled' y otros estados mantenemos toastT.promise
  const successMsg =
    status === 'cancelled'
      ? (['toasts.vacations.admin.cancelled'] as const)
      : (['toasts.vacations.admin.updated'] as const);

  try {
    await toastT.promise(
      updateVacationRequest(token, id, { status }),
      {
        pending: ['toasts.vacations.admin.updating'],
        success: successMsg,
        error: ['toasts.vacations.admin.error'],
      }
    );

    if (status === 'cancelled') {
      const req = requests.find(r => r._id === id);
      if (req) {
        invalidateAvailabilityByRange(req.startDate, req.endDate);
      }
      emitVacationSync({ id, status: 'cancelled' });
    }

    notifyVacationsChanged();
    fetchRequests();
  } catch {
    // el error ya se muestra por toast
  }
};


  const handleSendAlternativeOption = async (
    id: string,
    adminOptionStartDate: string,
    adminOptionEndDate: string,
    adminNote: string
  ) => {
    if (!token) return;
    try {
      await toastT.promise(
        updateVacationRequest(token, id, {
          status: 'option_sent',
          adminOptionStartDate,
          adminOptionEndDate,
          adminNote,
        }),
        {
          pending: ['toasts.vacations.admin.sendingAlt'],
          success: ['toasts.vacations.admin.altSent'],
          error: ['toasts.vacations.admin.error'],
        }
      );

      // ⚠️ option_sent no cambia capacidad ni estado final del worker → NO emitir

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    }
  };

  const handleConfirmCancel = async (id: string) => {
    if (!token) return;
    setIsSendingCancel(true);
    try {
      await toastT.promise(
        updateVacationRequest(token, id, {
          status: 'cancelled',
          adminNote: cancelMessage,
        }),
        {
          pending: ['toasts.vacations.admin.cancelling'],
          success: ['toasts.vacations.admin.cancelled'],
          error: ['toasts.vacations.admin.error'],
        }
      );

      // 🟢 Invalidar disponibilidad en vivo tras cancelar (libera cupo)
      const req = requests.find(r => r._id === id);
      if (req) {
        invalidateAvailabilityByRange(req.startDate, req.endDate);
      }

      // 🔔 Emitir sincronización a Worker
      emitVacationSync({ id, status: 'cancelled' });

      setCancelingRequestId(null);
      setCancelMessage('');

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    } finally {
      setIsSendingCancel(false);
    }
  };

  const openAlternativeModal = (reqId: string, startDate: string, endDate: string) => {
    setCurrentRequestId(reqId);
    setModalInitialStartDate(new Date(startDate));
    setModalInitialEndDate(new Date(endDate));
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-4">
            {t('pages.vacations.adminPage.title')}
          </h2>

          {/* Grid de meses con navegación de año */}
<AdminVacationMonthGrid
  key={`${gridYear}-${gridRefreshTick}`} // ✅ fuerza rerender cuando cambie la disponibilidad
  requests={requests}
  year={gridYear}
  onYearChange={(y) => setGridYear(y)}
  onMonthOpen={(monthIdx, y) => {
    setSelectedMonth(monthIdx);
    setSelectedYear(y);
  }}
/>


          {/* Modal del mes (abre con mes + AÑO correctos) */}
          <AdminVacationMonthModal
            isOpen={selectedMonth !== null}
            monthIndex={selectedMonth}
            requests={requests}
            year={selectedYear}
            onClose={() => setSelectedMonth(null)}
            onActionDone={fetchRequests}
          />

          {/* Estados */}
          {loading && (
            <p className="mt-2 text-sm text-gray-500">{t('pages.vacations.adminPage.loading')}</p>
          )}

          {!loading && error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && actionableRequests.length === 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {t('pages.vacations.adminPage.empty')}
            </p>
          )}

          {/* Tabla de solicitudes accionables */}
          {!loading && !error && actionableRequests.length > 0 && (
            <table className="w-full table-auto border-collapse text-sm shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden mt-4 text-center">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-center font-semibold text-slate-900">
                    {t('pages.vacations.adminPage.table.user')}
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-900">
                    {t('pages.vacations.adminPage.table.startDate')}
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-900">
                    {t('pages.vacations.adminPage.table.endDate')}
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-900">
                    {t('pages.vacations.adminPage.table.status')}
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-900">
                    {t('pages.vacations.adminPage.table.actions')}
                  </th>
                </tr>
              </thead>

              <tbody>
                {actionableRequests.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 border-t border-slate-200 text-center">
                      {req.user ? (
                        `${req.user.name} ${req.user.lastName}`
                      ) : (
                        <span className="text-red-500">Usuario no disponible</span>
                      )}
                    </td>

                    <td className="px-4 py-2 border-t border-slate-200 text-center">
                      {new Date(req.startDate).toLocaleDateString(locale, { timeZone: 'Europe/Berlin' })}
                    </td>

                    <td className="px-4 py-2 border-t border-slate-200 text-center">
                      {new Date(req.endDate).toLocaleDateString(locale, { timeZone: 'Europe/Berlin' })}
                    </td>

                    <td className="px-4 py-2 border-t border-slate-200 text-center">
                      <StatusBadge
                        context="vacation"
                        status={req.status}
                        label={t(`pages.vacations.adminPage.status.${req.status}`)}
                      />
                    </td>

                    <td className="px-4 py-2 border-t border-slate-200 text-center">
                      {cancelingRequestId === req._id ? (
                        <div className="flex flex-col items-center space-y-2">
                          <textarea
                            className="border rounded-xl p-2 w-64 ring-1 ring-slate-200"
                            placeholder={t('pages.vacations.adminPage.actions.cancelMessagePlaceholder')}
                            value={cancelMessage}
                            onChange={(e) => setCancelMessage(e.target.value)}
                          />
                          <div className="flex space-x-2">
                            <button
                              className="rounded-xl bg-red-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-4 focus:ring-red-100"
                              disabled={isSendingCancel}
                              onClick={() => handleConfirmCancel(req._id)}
                            >
                              {isSendingCancel ? t('pages.vacations.adminPage.actions.sending') : t('pages.vacations.adminPage.actions.confirm')}
                            </button>
                            <button
                              className="rounded-xl bg-gray-200 px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-gray-300 focus:ring-4 focus:ring-gray-100"
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
                        <div className="flex space-x-2 justify-center">
                          {req.status === 'pending' && (
                            <>
                              <button
                                className="rounded-xl bg-emerald-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100"
                                onClick={() => handleUpdateStatus(req._id, 'accepted')}
                              >
                                {t('pages.vacations.adminPage.actions.accept')}
                              </button>
                              <button
                                className="rounded-xl bg-indigo-500 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 focus:ring-4 focus:ring-indigo-100"
                                onClick={() =>
                                  openAlternativeModal(req._id, req.startDate, req.endDate)
                                }
                              >
                                {t('pages.vacations.adminPage.actions.altOption')}
                              </button>
                              <button
                                className="rounded-xl bg-rose-500 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-rose-600 focus:ring-4 focus:ring-rose-100"
                                onClick={() => setCancelingRequestId(req._id)}
                              >
                                {t('pages.vacations.adminPage.actions.cancel')}
                              </button>
                            </>
                          )}
                          {/* Para option_sent no mostramos acciones: está esperando respuesta del trabajador */}
                          {req.status === 'option_sent' && null}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* AlternativeDateModal */}
          <AlternativeDateModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            initialStartDate={modalInitialStartDate}
            initialEndDate={modalInitialEndDate}
            onSubmit={(altStart, altEnd, note) => {
              if (currentRequestId) {
                // option_sent no cambia capacidad
                handleSendAlternativeOption(currentRequestId, altStart, altEnd, note);
              }
              setIsModalOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminVacationRequests;
