import { useEffect, useState } from 'react';
import { getAllHospitals } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import HospitalDetailsModal from '../components/hospitals/HospitalDetailsModal';
import { useAuth } from '../hooks/useAuth';
import Select from 'react-select';
import { useTranslation } from 'react-i18next';

const WorkerHospitalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t('pages.hospitals.workerPage.title')}
      </h1>

      {/* Filtros */}
      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 md:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Buscar por nombre */}
          <div>
            <label
              htmlFor="hospitalNameSearch"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t('pages.hospitals.workerPage.filters.byName')}
            </label>
            <input
              id="hospitalNameSearch"
              type="text"
              placeholder={t('pages.hospitals.workerPage.filters.byNamePlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Filtrar por especialidad */}
          <div>
            <label
              htmlFor="specialtyFilter"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t('pages.hospitals.workerPage.filters.bySpecialty')}
            </label>
            <Select
              id="specialtyFilter"
              options={[
                { value: '', label: t('pages.hospitals.workerPage.filters.allSpecialties') },
                ...allSpecialties.map((spec) => ({ value: spec, label: spec })),
              ]}
              value={
                selectedSpecialty === ''
                  ? { value: '', label: t('pages.hospitals.workerPage.filters.allSpecialties') }
                  : { value: selectedSpecialty, label: selectedSpecialty }
              }
              onChange={(option) => setSelectedSpecialty(option?.value || '')}
              className="text-sm"
              classNamePrefix="react-select"
              placeholder={t('pages.hospitals.workerPage.filters.selectSpecialtyPlaceholder') as string}
              isSearchable
            />
          </div>
        </div>
      </div>

      {/* Listado */}
      <ul className="space-y-3">
        {filteredHospitals.map((hospital) => (
          <li
            key={hospital._id}
            className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 md:p-5 ring-1 ring-slate-200 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setSelectedHospital(hospital)}
              className="text-left"
              title={t('pages.hospitals.workerPage.actions.viewDetails') as string}
            >
              <span className="text-base md:text-lg font-semibold text-slate-900 hover:underline">
                {hospital.name}
              </span>
              {/* Dirección y especialidades ocultas en el listado; se ven en el modal */}
            </button>


            <div className="flex items-center gap-2" role="group" aria-label={t('pages.hospitals.workerPage.status.label') as string}>
              <span className="sr-only">
                {hospital.isOpen
                  ? t('pages.hospitals.workerPage.status.open')
                  : t('pages.hospitals.workerPage.status.closed')}
              </span>

              {/* Indicador verde (abierto) */}
              <div
                title={t('pages.hospitals.workerPage.status.open') as string}
                aria-hidden="true"
                className={`w-4 h-4 rounded-full border-2 ${hospital.isOpen ? 'bg-green-500 border-green-600' : 'bg-white border-slate-300'
                  }`}
              />

              {/* Indicador rojo (cerrado) */}
              <div
                title={t('pages.hospitals.workerPage.status.closed') as string}
                aria-hidden="true"
                className={`w-4 h-4 rounded-full border-2 ${!hospital.isOpen ? 'bg-rose-500 border-rose-600' : 'bg-white border-slate-300'
                  }`}
              />
            </div>

          </li>
        ))}
      </ul>

      {/* Modal detalles */}
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
