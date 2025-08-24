import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests, updateVacationRequest, deleteVacationRequest } from '../api/vacation';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import AdminVacationMonthGrid from '../components/vacation/AdminVacationMonthGrid';
import AdminVacationMonthModal from '../components/vacation/AdminVacationMonthModal';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

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
      setError(t('pages.vacations.adminPage.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  type VacationStatus = "pending" | "accepted" | "cancelled" | "option_sent";

  const handleUpdateStatus = async (id: string, status: VacationStatus) => {
    if (!token) return;
    try {
      await updateVacationRequest(token, id, { status });
      fetchRequests();
    } catch {
      alert(t('pages.vacations.adminPage.error'));
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
      await updateVacationRequest(token, id, {
        status: 'option_sent',
        adminOptionStartDate,
        adminOptionEndDate,
        adminNote,
      });
      fetchRequests();
    } catch {
      alert(t('pages.vacations.adminPage.error'));
    }
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
      fetchRequests();
    } catch (error) {
      alert(t('pages.vacations.adminPage.error'));
    } finally {
      setIsSendingCancel(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t('pages.vacations.adminPage.actions.confirmDelete'))) return;

    try {
      await deleteVacationRequest(token, id);
      fetchRequests();
    } catch {
      alert(t('pages.vacations.adminPage.error'));
    }
  };

  const openAlternativeModal = (reqId: string, startDate: string, endDate: string) => {
    setCurrentRequestId(reqId);
    setModalInitialStartDate(new Date(startDate));
    setModalInitialEndDate(new Date(endDate));
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">{t('pages.vacations.adminPage.title')}</h2>

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
        <table className="w-full table-auto border-collapse border border-gray-300 mt-4">
          <thead>
            <tr className="bg-gray-100 text-center">
              <th className="border border-gray-300 px-3 py-1">{t('pages.vacations.adminPage.table.user')}</th>
              <th className="border border-gray-300 px-3 py-1">{t('pages.vacations.adminPage.table.startDate')}</th>
              <th className="border border-gray-300 px-3 py-1">{t('pages.vacations.adminPage.table.endDate')}</th>
              <th className="border border-gray-300 px-3 py-1">{t('pages.vacations.adminPage.table.status')}</th>
              <th className="border border-gray-300 px-3 py-1">{t('pages.vacations.adminPage.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req._id} className="text-center">
                <td className="border border-gray-300 px-3 py-1">
                  {req.user ? (
                    `${req.user.name} ${req.user.lastName}`
                  ) : (
                    <span className="text-red-500">Usuario no disponible</span>
                  )}
                </td>
                <td className="border border-gray-300 px-3 py-1">
                  {new Date(req.startDate).toLocaleDateString(locale, { timeZone: 'Europe/Berlin' })}
                </td>
                <td className="border border-gray-300 px-3 py-1">
                  {new Date(req.endDate).toLocaleDateString(locale, { timeZone: 'Europe/Berlin' })}
                </td>
                <td
                  className={`border border-gray-300 px-3 py-1 capitalize font-semibold ${
                    req.status === 'accepted'
                      ? 'text-green-600'
                      : req.status === 'cancelled'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}
                >
                  {t(`pages.vacations.adminPage.status.${req.status}`)}
                </td>
                <td className="border border-gray-300 px-3 py-1">
                  {cancelingRequestId === req._id ? (
                    <div className="flex flex-col items-center space-y-2">
                      <textarea
                        className="border rounded p-2 w-64"
                        placeholder={t('pages.vacations.adminPage.actions.cancelMessagePlaceholder')}
                        value={cancelMessage}
                        onChange={(e) => setCancelMessage(e.target.value)}
                      />
                      <div className="flex space-x-2">
                        <button
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                          disabled={isSendingCancel}
                          onClick={() => handleConfirmCancel(req._id)}
                        >
                          {isSendingCancel ? t('pages.vacations.adminPage.actions.sending') : t('pages.vacations.adminPage.actions.confirm')}
                        </button>
                        <button
                          className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
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
                            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 whitespace-nowrap"
                            onClick={() => handleUpdateStatus(req._id, 'accepted')}
                          >
                            {t('pages.vacations.adminPage.actions.accept')}
                          </button>
                          <button
                            className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 whitespace-nowrap"
                            onClick={() =>
                              openAlternativeModal(
                                req._id,
                                req.startDate,
                                req.endDate
                              )
                            }
                          >
                            {t('pages.vacations.adminPage.actions.altOption')}
                          </button>
                          <button
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 whitespace-nowrap"
                            onClick={() => setCancelingRequestId(req._id)}
                          >
                            {t('pages.vacations.adminPage.actions.cancel')}
                          </button>
                        </>
                      )}
                      {(req.status === 'accepted' || req.status === 'cancelled') && (
                        <button
                          className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 whitespace-nowrap"
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
            handleSendAlternativeOption(
              currentRequestId,
              altStart,
              altEnd,
              note
            );
          }
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};

export default AdminVacationRequests;
