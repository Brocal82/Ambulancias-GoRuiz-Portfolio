import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getUserVacationRequests, respondToAlternativeDate } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import VacationRequestForm from '../components/vacation/VacationRequestForm';

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
        // Dentro del componente WorkerVacationsPage, en el return:

<table className="w-full table-auto border-collapse border border-gray-300 text-center">
  <thead>
    <tr className="bg-gray-100">
      <th className="border border-gray-300 px-3 py-1">Fecha Inicio</th>
      <th className="border border-gray-300 px-3 py-1">Fecha Fin</th>
      <th className="border border-gray-300 px-3 py-1">Estado</th>
      <th className="border border-gray-300 px-3 py-1">Opciones Alternativas</th>
      <th className="border border-gray-300 px-3 py-1">Acciones</th>
    </tr>
  </thead>
  <tbody>
    {requests.map(req => (
      <tr key={req._id}>
        <td className="border border-gray-300 px-3 py-1">{new Date(req.startDate).toLocaleDateString()}</td>
        <td className="border border-gray-300 px-3 py-1">{new Date(req.endDate).toLocaleDateString()}</td>
        <td className={`border border-gray-300 px-3 py-1 capitalize ${getStatusClass(req.status)}`}>
          {req.status}
        </td>
        <td className="border border-gray-300 px-3 py-1 break-words max-w-xs">
          {req.status === 'option_sent' && req.adminOptionStartDate && req.adminOptionEndDate ? (
            <>
              <p>Alternativa: {new Date(req.adminOptionStartDate).toLocaleDateString()} - {new Date(req.adminOptionEndDate).toLocaleDateString()}</p>
              <p>Nota: {req.adminNote || '-'}</p>
            </>
          ) : (
            '-'
          )}
        </td>
        <td className="border border-gray-300 px-3 py-1">
          {req.status === 'option_sent' && (
            <div className="flex justify-center space-x-2 flex-nowrap">
              <button
                className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 whitespace-nowrap"
                onClick={() => handleRespondAlternative(req._id, true)}
              >
                Aceptar
              </button>
              <button
                className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 whitespace-nowrap"
                onClick={() => handleRespondAlternative(req._id, false)}
              >
                Rechazar
              </button>
            </div>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>

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
