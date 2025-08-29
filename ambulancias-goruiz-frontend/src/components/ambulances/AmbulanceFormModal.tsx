import React, { useEffect, useState } from 'react';
import type { Ambulance } from '../../types/ambulance';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ambulance: Omit<Ambulance, '_id'>, id?: string) => Promise<void>;
  initialData?: Ambulance | null;
}

const MAX_LENGTH = 30;

const AmbulanceFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const { t } = useTranslation();

  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [ambulanceNumber, setAmbulanceNumber] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (initialData) {
      setBrand(initialData.brand);
      setModelName(initialData.modelName);
      setLicensePlate(initialData.licensePlate);
      setAmbulanceNumber(initialData.ambulanceNumber);
      setErrors({});
    } else {
      setBrand('');
      setModelName('');
      setLicensePlate('');
      setAmbulanceNumber('');
      setErrors({});
    }
  }, [initialData, isOpen]);

  const validateField = (value: string) => {
    if (!value.trim()) {
      return t('pages.ambulances.formModal.validation.required');
    }
    if (value.length > MAX_LENGTH) {
      return t('pages.ambulances.formModal.validation.maxLength', { max: MAX_LENGTH });
    }
    return '';
  };

  const validateAll = () => {
    const newErrors: { [key: string]: string } = {};
    newErrors.brand = validateField(brand);
    newErrors.modelName = validateField(modelName);
    newErrors.licensePlate = validateField(licensePlate);
    newErrors.ambulanceNumber = validateField(ambulanceNumber);
    setErrors(newErrors);
    return Object.values(newErrors).every((err) => err === '');
  };

  const handleChange = (field: string, value: string) => {
    switch (field) {
      case 'brand':
        setBrand(value);
        setErrors((prev) => ({ ...prev, brand: validateField(value) }));
        break;
      case 'modelName':
        setModelName(value);
        setErrors((prev) => ({ ...prev, modelName: validateField(value) }));
        break;
      case 'licensePlate':
        setLicensePlate(value);
        setErrors((prev) => ({ ...prev, licensePlate: validateField(value) }));
        break;
      case 'ambulanceNumber':
        setAmbulanceNumber(value);
        setErrors((prev) => ({ ...prev, ambulanceNumber: validateField(value) }));
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    await onSave(
      { brand, modelName, licensePlate, ambulanceNumber },
      initialData?._id,
    );
    onClose();
  };

  if (!isOpen) return null;

  const isSaveDisabled =
    Object.values(errors).some((err) => err !== '') ||
    !brand.trim() ||
    !modelName.trim() ||
    !licensePlate.trim() ||
    !ambulanceNumber.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded p-6 w-full max-w-md shadow-lg"
      >
        <h2 className="text-xl font-semibold mb-4">
          {initialData ? t('pages.ambulances.formModal.titleEdit') : t('pages.ambulances.formModal.titleNew')}
        </h2>

        <label className="block mb-2">
          {t('pages.ambulances.formModal.fields.brand')}
          <input
            type="text"
            value={brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.brand ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.brand && <p className="text-red-600 text-sm mt-1">{errors.brand}</p>}
        </label>

        <label className="block mb-2">
          {t('pages.ambulances.formModal.fields.model')}
          <input
            type="text"
            value={modelName}
            onChange={(e) => handleChange('modelName', e.target.value)}
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.modelName ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.modelName && <p className="text-red-600 text-sm mt-1">{errors.modelName}</p>}
        </label>

        <label className="block mb-2">
          {t('pages.ambulances.formModal.fields.licensePlate')}
          <input
            type="text"
            value={licensePlate}
            onChange={(e) => handleChange('licensePlate', e.target.value)}
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.licensePlate ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.licensePlate && (
            <p className="text-red-600 text-sm mt-1">{errors.licensePlate}</p>
          )}
        </label>

        <label className="block mb-4">
          {t('pages.ambulances.formModal.fields.ambulanceNumber')}
          <input
            type="text"
            value={ambulanceNumber}
            onChange={(e) => handleChange('ambulanceNumber', e.target.value)}
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.ambulanceNumber ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.ambulanceNumber && (
            <p className="text-red-600 text-sm mt-1">{errors.ambulanceNumber}</p>
          )}
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
          >
            {t('pages.ambulances.formModal.actions.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSaveDisabled}
            className={`px-4 py-2 rounded text-white ${
              isSaveDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {t('pages.ambulances.formModal.actions.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AmbulanceFormModal;
