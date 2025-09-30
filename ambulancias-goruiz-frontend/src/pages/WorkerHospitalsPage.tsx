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

  // Orden alfabético A→Z después de filtrar
  const sortedHospitals = [...filteredHospitals].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' })
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t('pages.hospitals.workerPage.title')}
      </h1>

      {/* Filtros (compacto, mismos estilos que Admin) */}
      <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 md:p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Buscar por nombre */}
          <div>
            <label
              htmlFor="hospitalNameSearch"
              className="block text-[11px] font-medium text-slate-700 mb-1"
            >
              {t('pages.hospitals.workerPage.filters.byName')}
            </label>
            <input
              id="hospitalNameSearch"
              type="text"
              placeholder={t('pages.hospitals.workerPage.filters.byNamePlaceholder') as string}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Filtrar por especialidad */}
          <div>
            <label
              htmlFor="specialtyFilter"
              className="block text-[11px] font-medium text-slate-700 mb-1"
            >
              {t('pages.hospitals.workerPage.filters.bySpecialty')}
            </label>
            <Select
              inputId="specialtyFilter"
              options={[
                { value: '', label: t('pages.hospitals.workerPage.filters.allSpecialties') as string },
                ...allSpecialties.map((spec) => ({ value: spec, label: spec })),
              ]}
              value={
                selectedSpecialty === ''
                  ? { value: '', label: t('pages.hospitals.workerPage.filters.allSpecialties') as string }
                  : { value: selectedSpecialty, label: selectedSpecialty }
              }
              onChange={(option) => setSelectedSpecialty(option?.value || '')}
              className="text-sm"
              classNamePrefix="react-select"
              placeholder={t('pages.hospitals.workerPage.filters.selectSpecialtyPlaceholder') as string}
              isSearchable
              /* Estilos compactos para react-select (igual que Admin) */
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: 32,
                  height: 32,
                  borderRadius: 8,
                  borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59,130,246,.2)' : 'none',
                }),
                valueContainer: (base) => ({
                  ...base,
                  padding: '0 8px',
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                }),
                indicatorsContainer: (base) => ({
                  ...base,
                  height: 32,
                }),
                dropdownIndicator: (base) => ({
                  ...base,
                  padding: '4px 6px',
                }),
                clearIndicator: (base) => ({
                  ...base,
                  padding: '4px 6px',
                }),
                menu: (base) => ({
                  ...base,
                  borderRadius: 8,
                  overflow: 'hidden',
                }),
              }}
            />
          </div>

          {/* (Hueco reservado por si luego añades un botón/acción) */}
          <div className="hidden md:block" />
        </div>
      </div>

      {/* Listado (compacto, igual que Admin) */}
      <ul className="space-y-2">
        {sortedHospitals.map((hospital) => (
          <li
            key={hospital._id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setSelectedHospital(hospital)}
              className="text-left"
              title={t('pages.hospitals.workerPage.actions.viewDetails') as string}
            >
              <span className="text-sm md:text-base font-semibold text-slate-900 hover:underline">
                {hospital.name}
              </span>
            </button>

            <div
              className="flex items-center gap-2"
              role="group"
              aria-label={t('pages.hospitals.workerPage.status.label') as string}
            >
              <span className="sr-only">
                {hospital.isOpen
                  ? t('pages.hospitals.workerPage.status.open')
                  : t('pages.hospitals.workerPage.status.closed')}
              </span>

              {/* Indicador verde (abierto) */}
              <div
                title={t('pages.hospitals.workerPage.status.open') as string}
                aria-hidden="true"
                className={`w-4 h-4 rounded-full border-2 ${
                  hospital.isOpen ? 'bg-green-500 border-green-600' : 'bg-white border-slate-300'
                }`}
              />

              {/* Indicador rojo (cerrado) */}
              <div
                title={t('pages.hospitals.workerPage.status.closed') as string}
                aria-hidden="true"
                className={`w-4 h-4 rounded-full border-2 ${
                  !hospital.isOpen ? 'bg-rose-500 border-rose-600' : 'bg-white border-slate-300'
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
