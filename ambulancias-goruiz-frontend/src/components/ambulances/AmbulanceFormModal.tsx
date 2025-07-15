import React, { useEffect, useState } from 'react';
import type { Ambulance } from '../../types/ambulance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ambulance: Omit<Ambulance, '_id'>, id?: string) => Promise<void>;
  initialData?: Ambulance | null;
}

const AmbulanceFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [ambulanceNumber, setAmbulanceNumber] = useState('');

  useEffect(() => {
    if (initialData) {
      setBrand(initialData.brand);
      setModelName(initialData.modelName);
      setLicensePlate(initialData.licensePlate);
      setAmbulanceNumber(initialData.ambulanceNumber);
    } else {
      setBrand('');
      setModelName('');
      setLicensePlate('');
      setAmbulanceNumber('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ brand, modelName, licensePlate, ambulanceNumber }, initialData?._id);
    onClose();
  };

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
            onChange={(e) => setBrand(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
          />
        </label>

        <label className="block mb-2">
          Modelo:
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
          />
        </label>

        <label className="block mb-2">
          Matrícula:
          <input
            type="text"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
          />
        </label>

        <label className="block mb-4">
          Número Ambulancia:
          <input
            type="text"
            value={ambulanceNumber}
            onChange={(e) => setAmbulanceNumber(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
          />
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
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

export default AmbulanceFormModal;
