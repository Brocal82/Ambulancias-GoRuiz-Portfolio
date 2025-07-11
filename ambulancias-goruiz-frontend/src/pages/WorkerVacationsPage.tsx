import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getUserVacationRequests, respondToAlternativeDate } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';

const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [modalInitialStartDate, setModalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate, setModalInitialEndDate] = useState<Date>(new Date());

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

  const openAlternativeModal = (reqId: string, startDate: string, endDate: string) => {
    setCurrentRequestId(reqId);
    setModalInitialStartDate(new Date(startDate));
    setModalInitialEndDate(new Date(endDate));
    setIsModalOpen(true);
  };

  if (loading) return <p>Cargando solicitudes...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (requests.length === 0) return <p>No hay solicitudes de vacaciones.</p>;

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Mis Solicitudes de Vacaciones</h2>
      <table className="w-full table-auto border-collapse border border-gray-300">
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
        <td className="border border-gray-300 px-3 py-1 capitalize">{req.status}</td>
        <td className="border border-gray-300 px-3 py-1">
          {req.status === 'option_sent' && req.adminOptionStartDate && req.adminOptionEndDate ? (
            <>
              <p>Alternativa: {new Date(req.adminOptionStartDate).toLocaleDateString()} - {new Date(req.adminOptionEndDate).toLocaleDateString()}</p>
              <p>Nota: {req.adminNote || '-'}</p>
            </>
          ) : (
            '-'
          )}
        </td>
        <td className="border border-gray-300 px-3 py-1 space-x-2">
          {req.status === 'option_sent' && (
            <>
              <button
                className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                onClick={() => handleRespondAlternative(req._id, true)}
              >
                Aceptar
              </button>
              <button
                className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                onClick={() => handleRespondAlternative(req._id, false)}
              >
                Rechazar
              </button>
            </>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>

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
