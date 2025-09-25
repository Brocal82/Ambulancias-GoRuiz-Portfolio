import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests, updateVacationRequest, deleteVacationRequest } from '../api/vacation';
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


const AdminVacationRequests = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [modalInitialStartDate, setModalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate, setModalInitialEndDate] = useState<Date>(new Date());
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');
  const [isSendingCancel, setIsSendingCancel] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

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

  type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';

  const handleUpdateStatus = async (id: string, status: VacationStatus) => {
    if (!token) return;

    const successMsg =
      status === 'accepted'
        ? (['toasts.vacations.admin.accepted'] as const)
        : status === 'cancelled'
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

      // 🔔 Notificar al Dashboard para refrescar el contador
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

  const handleDeleteRequest = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t('pages.vacations.adminPage.actions.confirmDelete'))) return;

    try {
      await toastT.promise(
        deleteVacationRequest(token, id),
        {
          pending: ['toasts.vacations.admin.deleting'],
          success: ['toasts.vacations.admin.deleted'],
          error: ['toasts.vacations.admin.error'],
        }
      );

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      fetchRequests();
    } catch {
      // el error ya se muestra por toast
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

        {/* Grid de meses */}
        <AdminVacationMonthGrid
          requests={requests}
          onMonthClick={(m) => setSelectedMonth(m)}
        />

        {/* Modal del mes */}
        <AdminVacationMonthModal
          isOpen={selectedMonth !== null}
          monthIndex={selectedMonth}
          requests={requests}
          year={new Date().getFullYear()}
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

        {!loading && !error && requests.length === 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {t('pages.vacations.adminPage.empty')}
          </p>
        )}

        {/* Tabla */}
{!loading && !error && requests.length > 0 && (
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
      {requests.map((req) => (
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
                {(req.status === 'accepted' || req.status === 'cancelled') && (
                  <button
                    className="rounded-xl bg-rose-700 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-rose-800 focus:ring-4 focus:ring-rose-100"
                    onClick={() => handleDeleteRequest(req._id)}
                  >
                    {t('pages.vacations.adminPage.actions.delete')}
                  </button>
                )}
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
