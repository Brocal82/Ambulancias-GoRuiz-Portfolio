import React, { useEffect, useState } from 'react';
import {
  getAllAmbulances,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance
} from '../api/ambulances';
import type { Ambulance } from '../types/ambulance';
import AmbulanceFormModal from '../components/ambulances/AmbulanceFormModal';
import { useAuth } from '../hooks/useAuth';

const AdminAmbulancesPage: React.FC = () => {
  const { token } = useAuth();

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [ambulanceToEdit, setAmbulanceToEdit] = useState<Ambulance | null>(null);

  useEffect(() => {
    fetchAmbulances();
  }, []);

  const fetchAmbulances = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAllAmbulances(token);
      setAmbulances(data);
      setError(null);
    } catch {
      setError('Error al cargar ambulancias');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setAmbulanceToEdit(null);
    setModalOpen(true);
  };

  const handleEdit = (amb: Ambulance) => {
    setAmbulanceToEdit(amb);
    setModalOpen(true);
  };

const handleDelete = async (id: string) => {
  if (!token) {
    alert('Token no disponible');
    return;
  }

  if (!window.confirm('¿Seguro que quieres eliminar esta ambulancia?')) return;

  try {
    await deleteAmbulance(id, token);
    fetchAmbulances();
  } catch {
    alert('Error al eliminar ambulancia');
  }
};


const handleSave = async (ambulanceData: Omit<Ambulance, '_id'>, id?: string) => {
  if (!token) {
    alert('Token no disponible');
    return;
  }

  try {
    if (id) {
      await updateAmbulance(id, ambulanceData, token);
    } else {
      await createAmbulance(ambulanceData, token);
    }
    setModalOpen(false);
    fetchAmbulances();
  } catch {
    alert('Error al guardar ambulancia');
  }
};


  if (loading) return <p className="text-center mt-10">Cargando ambulancias...</p>;
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Administración de Ambulancias</h1>

      <button
        onClick={handleOpenNew}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        + Nueva Ambulancia
      </button>

      {ambulances.length === 0 ? (
        <p className="text-center text-gray-500">No hay ambulancias registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-center">Marca</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Modelo</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Matrícula</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Número Ambulancia</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ambulances.map((amb) => (
                <tr key={amb._id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.brand}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.modelName}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.licensePlate}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.ambulanceNumber}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    <button
                      onClick={() => handleEdit(amb)}
                      className="mr-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(amb._id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AmbulanceFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={ambulanceToEdit}
      />
    </div>
  );
};

export default AdminAmbulancesPage;
