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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('pages.hospitals.editModal.title')}</h2>

        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder={t('pages.hospitals.editModal.inputs.name')}
          className="border p-2 rounded w-full mb-2"
        />
        <input
          type="text"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder={t('pages.hospitals.editModal.inputs.address')}
          className="border p-2 rounded w-full mb-2"
        />
        <input
          type="text"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder={t('pages.hospitals.editModal.inputs.phone')}
          className="border p-2 rounded w-full mb-4"
        />

        <div className="mb-4">
          <h3 className="font-medium mb-1">{t('pages.hospitals.editModal.specialties.title')}</h3>
          <ul className="mb-2">
            {specialties.map((spec) => (
              <li key={spec} className="flex justify-between items-center bg-gray-100 px-2 py-1 rounded mb-1 text-sm">
                {spec}
                <button
                  onClick={() => handleRemoveSpecialty(spec)}
                  className="text-red-500 hover:underline"
                >
                  ❌
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              list="specialty-options"
              type="text"
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              placeholder={t('pages.hospitals.editModal.specialties.newPlaceholder')}
              className="border p-1 rounded w-full"
            />
            <datalist id="specialty-options">
              {allSpecialties.map((spec) => (
                <option key={spec} value={spec} />
              ))}
            </datalist>
            <button
              onClick={handleAddSpecialty}
              className="bg-blue-500 text-white px-3 py-1 rounded"
            >
              ➕
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isOpen}
              onChange={handleToggleStatus}
            />
            {t('pages.hospitals.editModal.status.openCheckbox')}
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            {t('pages.hospitals.editModal.buttons.cancel')}
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded">
            {t('pages.hospitals.editModal.buttons.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HospitalEditModal;
