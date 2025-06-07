import { useEffect, useState } from 'react';
import { getAllHospitals, updateHospital } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

const AdminHospitalsPage = () => {
  const { token } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        if (!token) return;
        const data = await getAllHospitals(token);
        setHospitals(data);
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar hospitales');
      }
    };

    fetchHospitals();
  }, [token]);

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
      toast.success('Estado del hospital actualizado');
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar estado');
    }
  };

  const specialties = Array.from(
    new Set(hospitals.flatMap((h) => h.specialties))
  );

  const filteredHospitals =
    selectedSpecialty === 'all'
      ? hospitals
      : hospitals.filter((h) => h.specialties.includes(selectedSpecialty));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">Gestión de hospitales</h1>

      <label htmlFor="specialtyFilter" className="block mb-4">
        <span className="text-sm font-medium">Filtrar por especialidad:</span>
        <select
          id="specialtyFilter"
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
          className="border p-2 rounded w-full max-w-xs"
        >
          <option value="all">Todas las especialidades</option>
          {specialties.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
            </option>
          ))}
        </select>
      </label>

      <ul className="space-y-4">
        {filteredHospitals.map((hospital) => (
          <li
            key={hospital._id}
            className="p-4 border rounded shadow flex flex-col gap-2 bg-white"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{hospital.name}</h2>
              <label htmlFor={`hospital-status-${hospital._id}`} className="sr-only">
                Estado del hospital
              </label>
              <select
                id={`hospital-status-${hospital._id}`}
                value={hospital.isOpen ? 'open' : 'closed'}
                onChange={() => handleToggleOpen(hospital)}
                className={`border p-1 rounded text-sm ${
                  hospital.isOpen ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                <option value="open">🟢 Abierto</option>
                <option value="closed">🔴 Cerrado</option>
              </select>
            </div>
            <p className="text-sm">
              <strong>Dirección:</strong> {hospital.address}
            </p>
            <p className="text-sm">
              <strong>Teléfono:</strong> {hospital.phone}
            </p>
            <p className="text-sm">
              <strong>Especialidades:</strong> {hospital.specialties.join(', ')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminHospitalsPage;
