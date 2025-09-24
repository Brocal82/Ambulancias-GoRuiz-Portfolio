import { useEffect, useState } from 'react';
import { getAllHospitals, updateHospital, createHospital, deleteHospital } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import { useAuth } from '../hooks/useAuth';
import { toastT } from "../utils/toast";
import Select from 'react-select';
import { normalizeText } from '../utils/textUtils';
import HospitalEditModal from '../components/hospitals/HospitalEditModal';
import HospitalDetailsModal from '../components/hospitals/HospitalDetailsModal';
import { useTranslation } from 'react-i18next';

const AdminHospitalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [searchName, setSearchName] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    specialties: '',
  });

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        if (!token) return;
        const data = await getAllHospitals(token);
        setHospitals(data);
      } catch (error) {
        console.error(error);
        toastT.error(["toasts.hospitals.loadError"]);
      }
    };

    fetchHospitals();
  }, [token, t]);

  const handleToggleOpen = async (hospital: Hospital) => {
    try {
      if (!token) return;
      const updated = await updateHospital(
        hospital._id,
        { isOpen: !hospital.isOpen },
        token
      );
      setHospitals((prev) =>
        prev.map((h) => (h._id === updated._id ? updated : h))
      );
      toastT.success(["toasts.hospitals.stateUpdated"]);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.stateUpdateError"]);
    }
  };

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const newHospital = await createHospital(
        {
          name: form.name,
          address: form.address,
          phone: form.phone,
          specialties: form.specialties.split(',').map((s) => s.trim()),
          isOpen: true,
        },
        token
      );
      setHospitals((prev) => [...prev, newHospital]);
      toastT.success(["toasts.hospitals.addSuccess"]);
      setForm({ name: '', address: '', phone: '', specialties: '' });
      setShowForm(false);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.addError"]);
    }
  };

  const handleDeleteHospital = async (id: string) => {
    if (!token) return;
    if (!confirm(t('pages.hospitals.adminPage.confirm.delete'))) return;

    try {
      await deleteHospital(id, token);
      setHospitals((prev) => prev.filter((h) => h._id !== id));
      toastT.success(["toasts.hospitals.deleteSuccess"]);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.deleteError"]);
    }
  };

  const specialtiesSet = new Map<string, string>();

  hospitals.forEach((h) => {
    h.specialties.forEach((spec) => {
      const normalized = normalizeText(spec);
      if (!specialtiesSet.has(normalized)) {
        specialtiesSet.set(normalized, spec);
      }
    });
  });

  const specialties = Array.from(specialtiesSet.values());

  const filteredHospitals = hospitals.filter((h) => {
    const matchesSpecialty =
      selectedSpecialty === 'all' ||
      h.specialties.some(
        (spec) => normalizeText(spec) === normalizeText(selectedSpecialty)
      );
    const matchesName = h.name.toLowerCase().includes(searchName.toLowerCase());
    return matchesSpecialty && matchesName;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t('pages.hospitals.adminPage.title')}
      </h1>

      {/* Filtros */}
      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 md:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Filtro por nombre */}
          <div>
            <label
              htmlFor="hospitalNameSearch"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t('pages.hospitals.adminPage.filters.byName')}
            </label>
            <input
              id="hospitalNameSearch"
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder={t('pages.hospitals.adminPage.filters.byNamePlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Filtro por especialidad */}
          <div>
            <label
              htmlFor="specialtyFilter"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t('pages.hospitals.adminPage.filters.bySpecialty')}
            </label>
            <Select
              id="specialtyFilter"
              options={[
                { value: 'all', label: t('pages.hospitals.adminPage.filters.allSpecialties') },
                ...specialties.map((spec) => ({ value: spec, label: spec })),
              ]}
              value={
                selectedSpecialty === 'all'
                  ? { value: 'all', label: t('pages.hospitals.adminPage.filters.allSpecialties') }
                  : { value: selectedSpecialty, label: selectedSpecialty }
              }
              onChange={(option) => setSelectedSpecialty(option?.value || 'all')}
              className="text-sm"
              classNamePrefix="react-select"
              placeholder={t('pages.hospitals.adminPage.filters.selectSpecialtyPlaceholder') as string}
              isSearchable
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {showForm
              ? t('pages.hospitals.adminPage.actions.toggleFormClose')
              : t('pages.hospitals.adminPage.actions.toggleFormOpen')}
          </button>
        </div>

        {/* Formulario nuevo hospital */}
        {showForm && (
          <form
            onSubmit={handleAddHospital}
            className="mt-5 rounded-xl ring-1 ring-slate-200 p-4 md:p-5 bg-slate-50 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder={t('pages.hospitals.adminPage.form.name') as string}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <input
                type="text"
                placeholder={t('pages.hospitals.adminPage.form.phone') as string}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>

            <input
              type="text"
              placeholder={t('pages.hospitals.adminPage.form.address') as string}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              required
            />

            <div>
              <input
                type="text"
                placeholder={t('pages.hospitals.adminPage.form.specialties') as string}
                list="specialties"
                value={form.specialties}
                onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <datalist id="specialties">
                {specialties.map((spec) => (
                  <option key={spec} value={spec} />
                ))}
              </datalist>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {t('pages.hospitals.adminPage.actions.saveHospital')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Listado */}
      <ul className="space-y-3">
        {filteredHospitals.map((hospital) => (
          <li
            key={hospital._id}
            className="flex items-start justify-between gap-4 rounded-xl bg-white p-4 md:p-5 ring-1 ring-slate-200 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setSelectedHospital(hospital)}
              className="text-left"
              title={t('pages.hospitals.adminPage.actions.viewDetails') as string}
            >
              <span className="text-base md:text-lg font-semibold text-slate-900 hover:underline">
                {hospital.name}
              </span>
            </button>


            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <label
                htmlFor={`hospital-status-${hospital._id}`}
                className="sr-only"
              >
                {t('pages.hospitals.adminPage.status.label')}
              </label>
              <div className="flex items-center gap-2">
  {/* Botón verde (abierto) */}
  <button
    type="button"
    onClick={() => !hospital.isOpen && handleToggleOpen(hospital)}
    className={`w-5 h-5 rounded-full border-2 ${
      hospital.isOpen ? 'bg-green-500 border-green-600' : 'bg-white border-slate-300'
    }`}
    title={t('pages.hospitals.adminPage.status.open') as string}
  />

  {/* Botón rojo (cerrado) */}
  <button
    type="button"
    onClick={() => hospital.isOpen && handleToggleOpen(hospital)}
    className={`w-5 h-5 rounded-full border-2 ${
      !hospital.isOpen ? 'bg-rose-500 border-rose-600' : 'bg-white border-slate-300'
    }`}
    title={t('pages.hospitals.adminPage.status.closed') as string}
  />
</div>


              <button
                type="button"
                onClick={() => setEditingHospital(hospital)}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {t('pages.hospitals.adminPage.actions.edit')}
              </button>

              <button
                type="button"
                onClick={() => handleDeleteHospital(hospital._id)}
                className="inline-flex items-center rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                {t('pages.hospitals.adminPage.actions.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Modales */}
      {editingHospital && (
        <HospitalEditModal
          hospital={editingHospital}
          allSpecialties={specialties}
          onClose={() => setEditingHospital(null)}
          onUpdated={(updated) => {
            setHospitals((prev) =>
              prev.map((h) => (h._id === updated._id ? updated : h))
            );
            setEditingHospital(null);
          }}
        />
      )}

      {selectedHospital && (
        <HospitalDetailsModal
          hospital={selectedHospital}
          onClose={() => setSelectedHospital(null)}
        />
      )}
    </div>
  );

};

export default AdminHospitalsPage;
