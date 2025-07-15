import React, { useState, useEffect } from 'react';
import type { Ambulance } from '../../types/ambulance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    ambulanceId: string;
    team: string;
    date: string;  // ISO timestamp completo
    mileage: number;
    description: string;
  }) => Promise<void>;
  ambulances: Ambulance[];
  defaultAmbulanceId?: string;
}

const AmbulanceIssueReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  ambulances,
  defaultAmbulanceId,
}) => {
  const [ambulanceId, setAmbulanceId] = useState(defaultAmbulanceId || '');
  const [team, setTeam] = useState('');
  const [mileage, setMileage] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (defaultAmbulanceId) setAmbulanceId(defaultAmbulanceId);
  }, [defaultAmbulanceId]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!ambulanceId) newErrors.ambulanceId = 'Seleccione una ambulancia';
    if (!team.trim()) newErrors.team = 'El equipo es obligatorio';
    if (mileage === '' || mileage < 0) newErrors.mileage = 'Introduce un kilometraje válido';
    if (!description.trim()) newErrors.description = 'La descripción es obligatoria';
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const timestamp = new Date().toISOString();

    await onSubmit({ ambulanceId, team, mileage: Number(mileage), description, date: timestamp });

    // Limpiar formulario y cerrar modal
    setTeam('');
    setMileage('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded p-6 w-full max-w-md shadow-lg"
      >
        <h2 className="text-xl font-semibold mb-4">Reportar avería de ambulancia</h2>

        <label className="block mb-3">
          Ambulancia:
          <select
            value={ambulanceId}
            onChange={(e) => setAmbulanceId(e.target.value)}
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.ambulanceId ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">-- Seleccione ambulancia --</option>
            {ambulances.map((amb) => (
              <option key={amb._id} value={amb._id}>
                {amb.ambulanceNumber} - {amb.brand} {amb.modelName}
              </option>
            ))}
          </select>
          {errors.ambulanceId && (
            <p className="text-red-600 text-sm mt-1">{errors.ambulanceId}</p>
          )}
        </label>

        <label className="block mb-3">
          Equipo (driver y medic):
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="Ej: Juan Pérez y Ana López"
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.team ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.team && <p className="text-red-600 text-sm mt-1">{errors.team}</p>}
        </label>

        <label className="block mb-3">
          Kilometraje actual:
          <input
            type="number"
            value={mileage}
            min={0}
            onChange={(e) => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ej: 125000"
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.mileage ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.mileage && <p className="text-red-600 text-sm mt-1">{errors.mileage}</p>}
        </label>

        <label className="block mb-4">
          Descripción del problema:
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Detalle de la avería o incidente"
            className={`mt-1 block w-full border rounded px-3 py-2 ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.description && (
            <p className="text-red-600 text-sm mt-1">{errors.description}</p>
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
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Enviar reporte
          </button>
        </div>
      </form>
    </div>
  );
};

export default AmbulanceIssueReportModal;
