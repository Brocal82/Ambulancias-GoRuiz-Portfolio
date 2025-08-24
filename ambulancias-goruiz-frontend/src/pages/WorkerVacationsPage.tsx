import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getUserVacationRequests, respondToAlternativeDate } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import VacationRequestForm from '../components/vacation/VacationRequestForm';
import UserVacationList from '../components/vacation/UserVacationList';
import { useTranslation } from 'react-i18next';

const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [modalInitialStartDate, setModalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate, setModalInitialEndDate] = useState<Date>(new Date());
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
      if (data.length === 0) {
        setShowForm(true);
      } else {
        setShowForm(false);
      }
    } catch {
      setError(t('pages.vacations.workerPage.error'));
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
      await respondToAlternativeDate(token, id, { accept });
      fetchRequests();
    } catch {
      alert(t('pages.vacations.workerPage.error'));
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchRequests();
    setFormMessage(t('pages.vacations.workerPage.formSuccess'));
  };

  if (loading) return <p>{t('pages.vacations.workerPage.loading')}</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">{t('pages.vacations.workerPage.title')}</h2>

      <button
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? t('pages.vacations.workerPage.toggleCloseForm') : t('pages.vacations.workerPage.toggleOpenForm')}
      </button>

      {formMessage && (
        <p className="mb-4 text-green-600">{formMessage}</p>
      )}

      {showForm && <VacationRequestForm onSuccess={handleFormSuccess} />}

      {requests.length === 0 && !loading && !showForm && (
        <p>{t('pages.vacations.workerPage.empty')}</p>
      )}

      {requests.length > 0 && (
        <div className="mt-4">
          <UserVacationList
            requests={requests}
            onRespondAlternative={handleRespondAlternative}
          />
        </div>
      )}

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
  );
};

export default WorkerVacationsPage;
