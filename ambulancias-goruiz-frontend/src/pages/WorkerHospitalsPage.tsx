import { useEffect, useState } from 'react';
import { getAllHospitals } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import HospitalDetailsModal from '../components/hospitals/HospitalDetailsModal';
import { useAuth } from '../hooks/useAuth';

const WorkerHospitalsPage = () => {
  const { token } = useAuth(); // ✅ OBTENEMOS EL TOKEN AQUÍ
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  useEffect(() => {
    if (!token) return; // ✅ VERIFICAMOS QUE HAYA TOKEN
    getAllHospitals(token)
      .then(setHospitals)
      .catch((err) => {
        console.error('❌ Error al obtener hospitales:', err);
      });
  }, [token]); // ✅ DEPENDENCIA PARA CUANDO SE ACTUALIZA EL TOKEN

  const filteredHospitals = hospitals.filter((hospital) =>
    hospital.specialties.some((s) =>
      s.toLowerCase().includes(filter.toLowerCase())
    )
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Hospitales disponibles</h1>

      <input
        type="text"
        placeholder="Filtrar por especialidad..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border px-3 py-2 mb-4 w-full max-w-md rounded"
      />

      <ul className="space-y-4">
        {filteredHospitals.map((hospital) => (
          <li
            key={hospital._id}
            className="p-4 border rounded shadow flex justify-between items-center bg-white"
          >
            <div className="flex flex-col">
              <h2
                onClick={() => setSelectedHospital(hospital)}
                className="text-lg font-semibold hover:underline cursor-pointer"
              >
                {hospital.name}
              </h2>
            </div>
            <div
              className={`text-sm px-3 py-1 rounded font-medium ${
                hospital.isOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {hospital.isOpen ? '🟢 Abierto' : '🔴 Cerrado'}
            </div>
          </li>
        ))}
      </ul>

      {selectedHospital && (
        <HospitalDetailsModal
          hospital={selectedHospital}
          onClose={() => setSelectedHospital(null)}
        />
      )}
    </div>
  );
};

export default WorkerHospitalsPage;
