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

  // Form original
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    specialties: '',
  });

  // Creación: chips de especialidades
  const [specInput, setSpecInput] = useState<string>('');
  const [newSpecs, setNewSpecs] = useState<string[]>([]);

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

  // Helpers chips
  const addSpec = () => {
    const raw = (specInput || form.specialties).trim();
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setNewSpecs((prev) => {
      const set = new Set(prev);
      parts.forEach(p => set.add(p));
      return Array.from(set);
    });
    setSpecInput('');
    setForm((f) => ({ ...f, specialties: '' }));
  };

  const removeSpec = (s: string) => {
    setNewSpecs((prev) => prev.filter((x) => x !== s));
  };

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const tail = form.specialties.split(',').map((s) => s.trim()).filter(Boolean);
      const combinedSet = new Set<string>([...newSpecs, ...tail]);
      const finalSpecialties = Array.from(combinedSet);

      const newHospital = await createHospital(
        {
          name: form.name,
          address: form.address,
          phone: form.phone,
          specialties: finalSpecialties,
          isOpen: true,
        },
        token
      );
      setHospitals((prev) => [...prev, newHospital]);
      toastT.success(["toasts.hospitals.addSuccess"]);
      setForm({ name: '', address: '', phone: '', specialties: '' });
      setSpecInput('');
      setNewSpecs([]);
      setShowForm(false);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.addError"]);
    }
  };

  const handleDeleteHospital = async (id: string) => {
    if (!token) return;
    if (!confirm(t('pages.hospitals.adminPage.confirm.delete') as string)) return;
    try {
      await deleteHospital(id, token);
      setHospitals((prev) => prev.filter((h) => h._id !== id));
      toastT.success(["toasts.hospitals.deleteSuccess"]);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.deleteError"]);
    }
  };

  // Sugerencias únicas de especialidades
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

  // Filtro + ORDEN ALFABÉTICO (A→Z)
  const filteredHospitals = hospitals.filter((h) => {
    const matchesSpecialty =
      selectedSpecialty === 'all' ||
      h.specialties.some(
        (spec) => normalizeText(spec) === normalizeText(selectedSpecialty)
      );
    const matchesName = h.name.toLowerCase().includes(searchName.toLowerCase());
    return matchesSpecialty && matchesName;
  });
  const sortedHospitals = [...filteredHospitals].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' })
  );

return (
  <div className="p-6 max-w-5xl mx-auto">
    <h1 className="text-2xl font-bold text-center mb-6">
      {t('pages.hospitals.adminPage.title')}
    </h1>

    {/* Filtros (compacto, sin warnings) */}
    <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 md:p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        {/* Filtro por nombre */}
        <div>
          <label
            htmlFor="hospitalNameSearch"
            className="block text-[11px] font-medium text-slate-700 mb-1"
          >
            {t('pages.hospitals.adminPage.filters.byName')}
          </label>
          <input
            id="hospitalNameSearch"
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder={t('pages.hospitals.adminPage.filters.byNamePlaceholder') as string}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Filtro por especialidad */}
        <div>
          <label
            htmlFor="specialtyFilter"
            className="block text-[11px] font-medium text-slate-700 mb-1"
          >
            {t('pages.hospitals.adminPage.filters.bySpecialty')}
          </label>
          <Select
            inputId="specialtyFilter"
            options={[
              { value: 'all', label: t('pages.hospitals.adminPage.filters.allSpecialties') as string },
              ...specialties.map((spec) => ({ value: spec, label: spec })),
            ]}
            value={
              selectedSpecialty === 'all'
                ? { value: 'all', label: t('pages.hospitals.adminPage.filters.allSpecialties') as string }
                : { value: selectedSpecialty, label: selectedSpecialty }
            }
            onChange={(option) => setSelectedSpecialty(option?.value || 'all')}
            className="text-sm"
            classNamePrefix="react-select"
            placeholder={t('pages.hospitals.adminPage.filters.selectSpecialtyPlaceholder') as string}
            isSearchable
            /* Estilos compactos y accesibles para react-select */
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

        {/* Botón mostrar/ocultar formulario */}
        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {showForm
              ? (t('pages.hospitals.adminPage.actions.toggleFormClose') as string)
              : (t('pages.hospitals.adminPage.actions.toggleFormOpen') as string)}
          </button>
        </div>
      </div>
    </div>

    {/* Formulario nuevo hospital */}
    {showForm && (
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
        {/* Header del formulario */}
        <div className="flex items-center justify-between px-5 md:px-6 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
              <span aria-hidden>🏥</span>
            </div>
            <h3 className="text-sm md:text-base font-bold text-slate-900">
              {t('pages.hospitals.adminPage.form.newHospitalTitle', 'Nuevo hospital')}
            </h3>
          </div>
        </div>

        {/* Body del formulario */}
        <form onSubmit={handleAddHospital} className="px-5 md:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna izquierda: Nombre, Dirección, Teléfono */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                  {t('pages.hospitals.adminPage.form.nameLabel', 'Nombre')}
                </label>
                <input
                  type="text"
                  placeholder={t('pages.hospitals.adminPage.form.name') as string}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                  {t('pages.hospitals.adminPage.form.addressLabel', 'Dirección')}
                </label>
                <input
                  type="text"
                  placeholder={t('pages.hospitals.adminPage.form.address') as string}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                  {t('pages.hospitals.adminPage.form.phoneLabel', 'Teléfono')}
                </label>
                <input
                  type="text"
                  placeholder={t('pages.hospitals.adminPage.form.phone') as string}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>
            </div>

            {/* Columna derecha: Especialidades (con chips) */}
            <div className="space-y-3 md:border-l md:pl-5 border-slate-200">
              <div>
                <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                  {t('pages.hospitals.adminPage.form.specialtiesLabel', 'Especialidades')}
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('pages.hospitals.adminPage.form.specialties') as string}
                    list="specialties"
                    value={specInput || form.specialties}
                    onChange={(e) => {
                      setSpecInput(e.target.value);
                      setForm({ ...form, specialties: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addSpec();
                      }
                      if (e.key === 'Backspace' && (specInput || form.specialties).length === 0 && newSpecs.length) {
                        removeSpec(newSpecs[newSpecs.length - 1]);
                      }
                    }}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    onClick={addSpec}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                    title={t('pages.hospitals.adminPage.form.addSpecialtyBtn', 'Añadir especialidad') as string}
                    aria-label={t('pages.hospitals.adminPage.form.addSpecialtyBtn', 'Añadir especialidad') as string}
                  >
                    {t('common.add', 'Añadir')}
                  </button>
                </div>

                <datalist id="specialties">
                  {specialties.map((spec) => (
                    <option key={spec} value={spec} />
                  ))}
                </datalist>

                {/* Chips debajo */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {newSpecs.map((spec) => (
                    <span
                      key={spec}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      {spec}
                      <button
                        type="button"
                        onClick={() => removeSpec(spec)}
                        className="rounded-full px-1 text-slate-500 hover:bg-slate-200"
                        aria-label={t('common.remove', 'Quitar')}
                        title={t('common.remove', 'Quitar') as string}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {newSpecs.length === 0 && (
                    <span className="text-[11px] text-slate-500">
                      {t('pages.hospitals.adminPage.form.noSpecialtiesYet', 'Sin especialidades añadidas')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer del formulario */}
          <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {t('pages.hospitals.adminPage.actions.saveHospital')}
            </button>
          </div>
        </form>
      </div>
    )}

    {/* Listado (COMPACTO + ORDENADO) */}
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
            title={t('pages.hospitals.adminPage.actions.viewDetails') as string}
          >
            <span className="text-sm md:text-base font-semibold text-slate-900 hover:underline">
              {hospital.name}
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor={`hospital-status-${hospital._id}`}
              className="sr-only"
            >
              {t('pages.hospitals.adminPage.status.label')}
            </label>
            <div className="flex items-center gap-1.5">
              {/* Punto verde (abierto) */}
              <button
                type="button"
                onClick={() => !hospital.isOpen && handleToggleOpen(hospital)}
                className={`w-4 h-4 rounded-full border-2 ${
                  hospital.isOpen ? 'bg-green-500 border-green-600' : 'bg-white border-slate-300'
                }`}
                title={t('pages.hospitals.adminPage.status.open') as string}
              />
              {/* Punto rojo (cerrado) */}
              <button
                type="button"
                onClick={() => hospital.isOpen && handleToggleOpen(hospital)}
                className={`w-4 h-4 rounded-full border-2 ${
                  !hospital.isOpen ? 'bg-rose-500 border-rose-600' : 'bg-white border-slate-300'
                }`}
                title={t('pages.hospitals.adminPage.status.closed') as string}
              />
            </div>

            <button
              type="button"
              onClick={() => setEditingHospital(hospital)}
              className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {t('pages.hospitals.adminPage.actions.edit')}
            </button>

            <button
              type="button"
              onClick={() => handleDeleteHospital(hospital._id)}
              className="inline-flex items-center rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300"
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
