import { useState } from 'react';
import type { Hospital } from '../../types/hospital';
import { updateHospital } from '../../api/hospitals';
import { useAuth } from '../../hooks/useAuth';
import { toastT } from "../../utils/toast";
import { useTranslation } from 'react-i18next';

interface Props {
  hospital: Hospital;
  allSpecialties: string[];
  onClose: () => void;
  onUpdated: (updated: Hospital) => void;
}

const HospitalEditModal = ({ hospital, allSpecialties, onClose, onUpdated }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    name: hospital.name,
    address: hospital.address,
    phone: hospital.phone,
    isOpen: hospital.isOpen,
  });

  const [specialties, setSpecialties] = useState([...hospital.specialties]);
  const [newSpecialty, setNewSpecialty] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleToggleStatus = () => {
    setForm({ ...form, isOpen: !form.isOpen });
  };

  const handleAddSpecialty = () => {
    const trimmed = newSpecialty.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties((prev) => [...prev, trimmed]);
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (spec: string) => {
    setSpecialties((prev) => prev.filter((s) => s !== spec));
  };

  const handleSubmit = async () => {
    if (!token) return;
    try {
      const updated = await updateHospital(hospital._id, { ...form, specialties }, token);
      onUpdated(updated);
      toastT.success(["toasts.hospitals.updateSuccess"]);
      onClose();
    } catch (err) {
      console.error(err);
      toastT.error(["toasts.hospitals.updateError"]);
    }
  };

  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 md:p-6 ring-1 ring-slate-200 shadow-xl">
      {/* Cerrar */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('pages.hospitals.editModal.buttons.cancel') as string}
        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        ×
      </button>

      {/* Título */}
      <h2 className="text-xl font-bold mb-4 pr-10">
        {t('pages.hospitals.editModal.title')}
      </h2>

      {/* Campos principales */}
      <div className="space-y-3">
        <div>
          <label htmlFor="hospital-name" className="block text-sm font-medium text-slate-700 mb-1">
            {t('pages.hospitals.editModal.inputs.name')}
          </label>
          <input
            id="hospital-name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder={t('pages.hospitals.editModal.inputs.name') as string}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label htmlFor="hospital-address" className="block text-sm font-medium text-slate-700 mb-1">
            {t('pages.hospitals.editModal.inputs.address')}
          </label>
          <input
            id="hospital-address"
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder={t('pages.hospitals.editModal.inputs.address') as string}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label htmlFor="hospital-phone" className="block text-sm font-medium text-slate-700 mb-1">
            {t('pages.hospitals.editModal.inputs.phone')}
          </label>
          <input
            id="hospital-phone"
            type="text"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder={t('pages.hospitals.editModal.inputs.phone') as string}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Especialidades */}
      <div className="mt-5">
        <h3 className="text-sm font-medium text-slate-800 mb-2">
          {t('pages.hospitals.editModal.specialties.title')}
        </h3>

        {/* Chips actuales */}
        <div className="mb-3 flex flex-wrap gap-2">
          {specialties.length === 0 ? (
            <span className="text-xs text-slate-500">
              {t('pages.hospitals.editModal.specialties.empty')}
            </span>
          ) : (
            specialties.map((spec) => (
              <span
                key={spec}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {spec}
                <button
                  type="button"
                  onClick={() => handleRemoveSpecialty(spec)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-rose-600 focus:outline-none"
                  title={t('pages.hospitals.editModal.specialties.remove') as string}
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>

        {/* Añadir especialidad */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <label htmlFor="new-specialty" className="sr-only">
              {t('pages.hospitals.editModal.specialties.newPlaceholder')}
            </label>
            <input
              id="new-specialty"
              list="specialty-options"
              type="text"
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              placeholder={t('pages.hospitals.editModal.specialties.newPlaceholder') as string}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <datalist id="specialty-options">
              {allSpecialties.map((spec) => (
                <option key={spec} value={spec} />
              ))}
            </datalist>
          </div>

          <button
            type="button"
            onClick={handleAddSpecialty}
            className="rounded-md bg-blue-600 px-4 py-2 text-white font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            title={t('pages.hospitals.editModal.specialties.add') as string}
          >
            ➕
          </button>
        </div>
      </div>

      {/* Estado abierto/cerrado */}
      <div className="mt-5">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isOpen}
            onChange={handleToggleStatus}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
          />
          {t('pages.hospitals.editModal.status.openCheckbox')}
        </label>
      </div>

      {/* Acciones */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          {t('pages.hospitals.editModal.buttons.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md bg-green-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          {t('pages.hospitals.editModal.buttons.save')}
        </button>
      </div>
    </div>
  </div>
);

};

export default HospitalEditModal;
