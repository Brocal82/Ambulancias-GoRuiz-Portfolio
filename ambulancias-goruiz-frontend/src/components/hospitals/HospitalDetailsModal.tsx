import type { Hospital } from '../../types/hospital';

interface Props {
  hospital: Hospital;
  onClose: () => void;
}

const HospitalDetailsModal = ({ hospital, onClose }: Props) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{hospital.name}</h2>

        <p className="mb-2"><strong>Dirección:</strong> {hospital.address}</p>
        <p className="mb-2"><strong>Teléfono:</strong> {hospital.phone}</p>
        <div className="mb-2">
          <strong>Especialidades:</strong>
          <ul className="list-disc list-inside mt-1">
            {hospital.specialties.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="mt-4 px-4 py-2 border rounded">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HospitalDetailsModal;
