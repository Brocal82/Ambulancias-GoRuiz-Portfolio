import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getUserVacationRequests, respondToAlternativeDate } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import VacationRequestForm from '../components/vacation/VacationRequestForm';
import UserVacationList from '../components/vacation/UserVacationList';

const WorkerVacationsPage = () => {
  const { token } = useAuth();
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
      console.log('Solicitudes de vacaciones del trabajador:', data);
      setRequests(data);
      setError('');
    } catch {
      setError('Error al cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

 useEffect(() => {
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
      setError('Error al cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  fetchRequests();
}, [token]);

  const handleRespondAlternative = async (id: string, accept: boolean) => {
    if (!token) return;
    try {
      await respondToAlternativeDate(token, id, { accept });
      fetchRequests();
    } catch {
      alert('Error al responder a la opción alternativa');
    }
  };

const getStatusClass = (status: string) => {
  switch(status) {
    case 'accepted':
      return 'text-green-600 font-semibold';
    case 'cancelled':
      return 'text-red-600 font-semibold';
    case 'pending':
    case 'option_sent':
      return 'text-yellow-600 font-semibold';
    default:
      return '';
  }
};


  const openAlternativeModal = (reqId: string, startDate: string, endDate: string) => {
    setCurrentRequestId(reqId);
    setModalInitialStartDate(new Date(startDate));
    setModalInitialEndDate(new Date(endDate));
    setIsModalOpen(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchRequests();
    setFormMessage('Solicitud enviada correctamente.');
  };

  if (loading) return <p>Cargando solicitudes...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Mis Solicitudes de Vacaciones</h2>

      <button
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? 'Cerrar formulario' : 'Nueva solicitud'}
      </button>

      {formMessage && (
        <p className="mb-4 text-green-600">{formMessage}</p>
      )}

      {showForm && <VacationRequestForm onSuccess={handleFormSuccess} />}

      {requests.length === 0 && !loading && !showForm && <p>No hay solicitudes de vacaciones.</p>}

{requests.length > 0 && (
  <div className="mt-4">
    <UserVacationList
      requests={requests}
      onRespondAlternative={handleRespondAlternative}
    />
  </div>
)}


      {/* El modal puede quedarse para otras funciones o eliminarse si no lo usas aquí */}
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
