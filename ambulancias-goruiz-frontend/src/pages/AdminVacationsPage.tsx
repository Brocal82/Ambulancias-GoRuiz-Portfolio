import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests, updateVacationRequest, deleteVacationRequest } from '../api/vacation';
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
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState('');
  const [isSendingCancel, setIsSendingCancel] = useState(false); // para loading del envío


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

  const handleConfirmCancel = async (id: string) => {
  if (!token) return;
  setIsSendingCancel(true);
  try {
    // Aquí llamaremos a la función para actualizar el estado y enviar el mensaje
    await updateVacationRequest(token, id, {
      status: 'cancelled',
      adminNote: cancelMessage,
    });
    setCancelingRequestId(null);
    setCancelMessage('');
    fetchRequests(); // refrescar lista
  } catch (error) {
    alert('Error al cancelar la solicitud');
  } finally {
    setIsSendingCancel(false);
  }
};


  const handleDeleteRequest = async (id: string) => {
  if (!token) return;
  if (!window.confirm('¿Seguro que quieres eliminar esta solicitud?')) return;

  try {
    await deleteVacationRequest(token, id);
    fetchRequests(); // refrescar lista
  } catch {
    alert('Error al eliminar la solicitud');
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
    <tr className="bg-gray-100 text-center">
      <th className="border border-gray-300 px-3 py-1">Usuario</th>
      <th className="border border-gray-300 px-3 py-1">Fecha Inicio</th>
      <th className="border border-gray-300 px-3 py-1">Fecha Fin</th>
      <th className="border border-gray-300 px-3 py-1">Estado</th>
      <th className="border border-gray-300 px-3 py-1">Acciones</th>
    </tr>
  </thead>
  <tbody>
    {requests.map(req => (
      <tr key={req._id} className="text-center">
        <td className="border border-gray-300 px-3 py-1">{req.user.name} {req.user.lastName}</td>
        <td className="border border-gray-300 px-3 py-1">{new Date(req.startDate).toLocaleDateString()}</td>
        <td className="border border-gray-300 px-3 py-1">{new Date(req.endDate).toLocaleDateString()}</td>
        <td
          className={`border border-gray-300 px-3 py-1 capitalize font-semibold ${
            req.status === 'accepted' ? 'text-green-600' :
            req.status === 'cancelled' ? 'text-red-600' :
            'text-yellow-600'
          }`}
        >
          {req.status}
        </td>
        <td className="border border-gray-300 px-3 py-1">
  {cancelingRequestId === req._id ? (
    <div className="flex flex-col items-center space-y-2">
      <textarea
        className="border rounded p-2 w-64"
        placeholder="Mensaje para el trabajador"
        value={cancelMessage}
        onChange={(e) => setCancelMessage(e.target.value)}
      />
      <div className="flex space-x-2">
        <button
          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          disabled={isSendingCancel}
          onClick={() => handleConfirmCancel(req._id)}
        >
          {isSendingCancel ? 'Enviando...' : 'Confirmar'}
        </button>
        <button
          className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
          disabled={isSendingCancel}
          onClick={() => {
            setCancelingRequestId(null);
            setCancelMessage('');
          }}
        >
          Cancelar
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
            Aceptar
          </button>
          <button
            className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 whitespace-nowrap"
            onClick={() => openAlternativeModal(req._id, req.startDate, req.endDate)}
          >
            Opción 2
          </button>
          <button
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 whitespace-nowrap"
            onClick={() => setCancelingRequestId(req._id)}
          >
            Cancelar
          </button>
        </>
      )}
      {(req.status === 'accepted' || req.status === 'cancelled') && (
        <button
          className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 whitespace-nowrap"
          onClick={() => handleDeleteRequest(req._id)}
        >
          Eliminar
        </button>
      )}
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
