// src/pages/WorkerVacationsPage.tsx
import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getUserVacationRequests, respondToAlternativeDate } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import VacationRequestForm from '../components/vacation/VacationRequestForm';
import UserVacationList from '../components/vacation/UserVacationList';
import { useTranslation } from 'react-i18next';
import { toastT } from '../utils/toast';

const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ⚠️ Solo mantenemos el estado que realmente se usa para el modal.
  // Quitamos currentRequestId (no se utilizaba) y los setters no usados.
  const [modalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate] = useState<Date>(new Date());

  const [showForm, setShowForm] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getUserVacationRequests(token);
      setRequests(data);
      setError('');

      // Mostrar formulario si no hay solicitudes
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
    } catch {
      // el error ya se muestra por toast
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    toastT.success(['toasts.vacations.worker.formSuccess']);
    fetchRequests();
    // Mantengo formMessage para no romper UI existente (puedes quitarlo cuando quieras)
    setFormMessage(t('toasts.vacations.worker.formSuccess'));
  };

  if (loading) return <p className="p-4 text-sm text-slate-600">{t('pages.vacations.workerPage.loading')}</p>;
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('pages.vacations.workerPage.title')}
          </h2>
        </div>

        {/* Card principal */}
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

            {formMessage && (
              <p className="text-sm text-emerald-700">{formMessage}</p>
            )}
          </div>

          {/* Formulario (si corresponde) */}
          {showForm && (
            <div className="mb-4 rounded-xl ring-1 ring-slate-200 p-3 bg-slate-50">
              <VacationRequestForm onSuccess={handleFormSuccess} />
            </div>
          )}

          {/* Sin solicitudes */}
          {requests.length === 0 && !loading && !showForm && (
            <p className="text-sm text-slate-600">{t('pages.vacations.workerPage.empty')}</p>
          )}

          {/* Listado de solicitudes */}
          {requests.length > 0 && (
            <div className="mt-2">
              <UserVacationList
                requests={requests}
                onRespondAlternative={handleRespondAlternative}
              />
            </div>
          )}
        </div>

        {/* Modal secundario si lo necesitas para otra acción */}
        <AlternativeDateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialStartDate={modalInitialStartDate}
          initialEndDate={modalInitialEndDate}
          onSubmit={() => {
            setIsModalOpen(false);
          }}
        />
      </div>
    </div>
  );
};

export default WorkerVacationsPage;
