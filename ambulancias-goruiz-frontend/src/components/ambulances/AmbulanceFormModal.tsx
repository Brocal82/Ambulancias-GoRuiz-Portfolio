import React, { useEffect, useState } from 'react';
import type { Ambulance } from '../../types/ambulance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ambulance: Omit<Ambulance, '_id'>, id?: string) => Promise<void>;
  initialData?: Ambulance | null;
}

const MAX_LENGTH = 30;

const AmbulanceFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [ambulanceNumber, setAmbulanceNumber] = useState('');

  // Errores
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

  // Validar un campo
  const validateField = (name: string, value: string) => {
    if (!value.trim()) {
      return 'Este campo es obligatorio';
    }
    if (value.length > MAX_LENGTH) {
      return `No puede tener más de ${MAX_LENGTH} caracteres`;
    }
    return '';
  };

  // Validar todos los campos
  const validateAll = () => {
    const newErrors: { [key: string]: string } = {};
    newErrors.brand = validateField('brand', brand);
    newErrors.modelName = validateField('modelName', modelName);
    newErrors.licensePlate = validateField('licensePlate', licensePlate);
    newErrors.ambulanceNumber = validateField('ambulanceNumber', ambulanceNumber);
    setErrors(newErrors);
    // Retorna true si no hay errores
    return Object.values(newErrors).every((err) => err === '');
  };

  // Manejar cambio y validación en cada input
  const handleChange = (field: string, value: string) => {
    switch (field) {
      case 'brand':
        setBrand(value);
        setErrors((prev) => ({ ...prev, brand: validateField(field, value) }));
        break;
      case 'modelName':
        setModelName(value);
        setErrors((prev) => ({ ...prev, modelName: validateField(field, value) }));
        break;
      case 'licensePlate':
        setLicensePlate(value);
        setErrors((prev) => ({ ...prev, licensePlate: validateField(field, value) }));
        break;
      case 'ambulanceNumber':
        setAmbulanceNumber(value);
        setErrors((prev) => ({ ...prev, ambulanceNumber: validateField(field, value) }));
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
          {initialData ? 'Editar Ambulancia' : 'Crear Nueva Ambulancia'}
        </h2>

        <label className="block mb-2">
          Marca:
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
          Modelo:
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
          Matrícula:
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
          Número Ambulancia:
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
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaveDisabled}
            className={`px-4 py-2 rounded text-white ${
              isSaveDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

export default AmbulanceFormModal;
