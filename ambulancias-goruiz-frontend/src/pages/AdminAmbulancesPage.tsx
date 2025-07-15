import React, { useEffect, useState } from 'react';
import { getAllAmbulances } from '../api/ambulances';
import type { Ambulance } from '../types/ambulance';

const AdminAmbulancesPage: React.FC = () => {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAmbulances = async () => {
      try {
        const data = await getAllAmbulances();
        setAmbulances(data);
      } catch (err) {
        setError('Error al cargar ambulancias');
      } finally {
        setLoading(false);
      }
    };
    fetchAmbulances();
  }, []);

  if (loading) return <p className="text-center mt-10">Cargando ambulancias...</p>;
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Administración de Ambulancias</h1>

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
  </tr>
</thead>
<tbody>
  {ambulances.map((amb) => (
    <tr key={amb._id} className="hover:bg-gray-50">
      <td className="border border-gray-300 px-4 py-2 text-center">{amb.brand}</td>
      <td className="border border-gray-300 px-4 py-2 text-center">{amb.modelName}</td>
      <td className="border border-gray-300 px-4 py-2 text-center">{amb.licensePlate}</td>
      <td className="border border-gray-300 px-4 py-2 text-center">{amb.ambulanceNumber}</td>
    </tr>
  ))}
</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAmbulancesPage;
