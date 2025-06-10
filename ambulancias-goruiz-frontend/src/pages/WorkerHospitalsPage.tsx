import { useEffect, useState } from 'react';
import { getAllHospitals } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import HospitalDetailsModal from '../components/hospitals/HospitalDetailsModal';
import { useAuth } from '../hooks/useAuth';
import Select from 'react-select'

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
      <h1 className="text-2xl font-bold mb-4 text-center">🏥 Hospitales disponibles</h1>

      <div className="flex flex-col gap-4 max-w-sm mx-auto mb-6">
        <div>
          <label htmlFor="hospitalNameSearch" className="block text-sm font-medium mb-1">
              Filtrar por nombre:
          </label>
          <input
            type="text"
            placeholder="Buscar hospital por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-2 rounded w-full"
          />
        </div>
        <div>
          <label htmlFor="specialtyFilter" className="block text-sm font-medium mb-1">
              Filtrar por especialidad:
          </label>
          <Select
            id="specialtyFilter"
            options={[
              { value: '', label: 'Todas las especialidades' },
              ...allSpecialties.map((spec) => ({ value: spec, label: spec })),
            ]}
            value={
              selectedSpecialty === ''
                ? { value: '', label: 'Todas las especialidades' }
                : { value: selectedSpecialty, label: selectedSpecialty }
            }
            onChange={(option) => setSelectedSpecialty(option?.value || '')}
            className="text-sm"
            classNamePrefix="react-select"
            placeholder="Selecciona una especialidad"
            isSearchable
          />
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
