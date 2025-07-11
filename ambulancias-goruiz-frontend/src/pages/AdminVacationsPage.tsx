import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests, updateVacationRequest } from '../api/vacation';
import AlternativeDateModal from '../components/vacation/AlternativeDateModal';
import { useAuth } from '../hooks/useAuth';

const AdminVacationRequests = () => {
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
      const data = await getVacationRequests(token); 
      console.log('Datos recibidos de solicitudes de vacaciones:', data);
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
  }, []);

  type VacationStatus = "pending" | "accepted" | "cancelled" | "option_sent";

  const handleUpdateStatus = async (id: string, status: VacationStatus) => {
    if (!token) return;
    try {
      await updateVacationRequest(token, id, { status }); // no token
      fetchRequests();
    } catch {
      alert('Error actualizando la solicitud');
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
      alert('Error enviando opción alternativa');
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
      <h2 className="text-xl font-bold mb-4">Solicitudes de Vacaciones</h2>
      <table className="w-full table-auto border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-3 py-1">Usuario</th>
            <th className="border border-gray-300 px-3 py-1">Fecha Inicio</th>
            <th className="border border-gray-300 px-3 py-1">Fecha Fin</th>
            <th className="border border-gray-300 px-3 py-1">Estado</th>
            <th className="border border-gray-300 px-3 py-1">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(req => (
            <tr key={req._id}>
              <td className="border border-gray-300 px-3 py-1">{req.user.name} {req.user.lastName}</td>
              <td className="border border-gray-300 px-3 py-1">{new Date(req.startDate).toLocaleDateString()}</td>
              <td className="border border-gray-300 px-3 py-1">{new Date(req.endDate).toLocaleDateString()}</td>
              <td className="border border-gray-300 px-3 py-1 capitalize">{req.status}</td>
              <td className="border border-gray-300 px-3 py-1 space-x-2">
                {req.status === 'pending' && (
                  <div className="flex space-x-2">
                    <button
                      className="flex-1 bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                      onClick={() => handleUpdateStatus(req._id, 'accepted')}
                    >
                      Aceptar
                    </button>
                    <button
                      className="flex-1 bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      onClick={() => handleUpdateStatus(req._id, 'cancelled')}
                    >
                      Cancelar
                    </button>
                    <button
                      className="flex-1 bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                      onClick={() => openAlternativeModal(req._id, req.startDate, req.endDate)}
                    >
                      Opción 2
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  );
};

export default AdminVacationRequests;
