import { useEffect, useState } from 'react';
import { getAllHospitals } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import HospitalDetailsModal from '../components/hospitals/HospitalDetailsModal';
import { useAuth } from '../hooks/useAuth';

const WorkerHospitalsPage = () => {
  const { token } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  useEffect(() => {
    if (!token) return;
    getAllHospitals(token)
      .then(setHospitals)
      .catch((err) => console.error('Error al cargar hospitales:', err));
  }, [token]);

  const allSpecialties = Array.from(
    new Set(hospitals.flatMap((h) => h.specialties))
  ).sort();

  const filteredHospitals = hospitals.filter((hospital) => {
    const matchesName = hospital.name.toLowerCase().includes(search.toLowerCase());
    const matchesSpecialty =
      selectedSpecialty === '' ||
      hospital.specialties.includes(selectedSpecialty);
    return matchesName && matchesSpecialty;
  });

  return (
    <div className="p-6">
      <div className="max-w-sm mx-auto mb-6">
  <h1 className="text-xl font-bold mb-4 text-center">🏥 Hospitales disponibles</h1>

  <div className="flex flex-col gap-4">
    <input
      type="text"
      placeholder="Buscar hospital por nombre..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="border px-3 py-2 rounded w-full"
    />

    <select
      aria-label="Filtrar por especialidad"
      value={selectedSpecialty}
      onChange={(e) => setSelectedSpecialty(e.target.value)}
      className="border px-3 py-2 rounded w-full"
    >
      <option value="">Todas las especialidades</option>
      {allSpecialties.map((spec) => (
        <option key={spec} value={spec}>
          {spec}
        </option>
      ))}
    </select>
  </div>
</div>


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
                hospital.isOpen
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
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
