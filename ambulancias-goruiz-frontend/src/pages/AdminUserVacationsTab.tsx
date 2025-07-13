// src/pages/AdminUserVacationsTab.tsx
import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import { deleteVacationRequest } from '../api/vacation';

interface Props {
    userId: string;
}

const AdminUserVacationsTab = ({ userId }: Props) => {
    const { token } = useAuth();
    const [vacations, setVacations] = useState<IVacationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token || !userId) return;

        const fetchVacations = async () => {
            setLoading(true);
            try {
                const allVacations = await getVacationRequests(token);
                const acceptedVacations = allVacations.filter(
                    (v: IVacationRequest) => v.user._id === userId && v.status === 'accepted'
                );

                setVacations(acceptedVacations);
                setError('');
            } catch (err) {
                setError('Error al cargar las vacaciones.');
            } finally {
                setLoading(false);
            }
        };

        fetchVacations();
    }, [token, userId]);

    const handleDeleteVacation = async (id: string) => {
  if (!token) return;

  if (!window.confirm('¿Estás seguro de eliminar esta solicitud de vacaciones?')) return;

  try {
    await deleteVacationRequest(token, id);
    setVacations(vacations.filter(vac => vac._id !== id)); // actualizar estado local
  } catch (error) {
    alert('Error al eliminar la solicitud');
  }
};

// Para editar, de momento mostramos un alert (o implementamos modal después)
const handleEditVacation = (id: string) => {
  alert(`Funcionalidad de editar solicitud ${id} pendiente de implementar.`);
};

    if (loading) return <p>Cargando vacaciones...</p>;
    if (error) return <p className="text-red-500">{error}</p>;
    if (vacations.length === 0) return <p>No hay vacaciones aceptadas.</p>;

    return (
        <div>
            <h3 className="text-lg font-semibold mb-4">Vacaciones aceptadas</h3>
            <ul className="list-disc pl-6 space-y-2">
  {vacations.map(vac => (
    <li key={vac._id} className="flex items-center justify-between">
      <span>
        {new Date(vac.startDate).toLocaleDateString()} - {new Date(vac.endDate).toLocaleDateString()}
      </span>
      <div className="space-x-2">
        <button
          className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          onClick={() => handleEditVacation(vac._id)}
        >
          Editar
        </button>
        <button
          className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          onClick={() => handleDeleteVacation(vac._id)}
        >
          Eliminar
        </button>
      </div>
    </li>
  ))}
</ul>

        </div>
    );
};

export default AdminUserVacationsTab;
