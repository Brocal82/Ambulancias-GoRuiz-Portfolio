import { useState } from 'react';
import type { Hospital } from '../../types/hospital';
import { updateHospital } from '../../api/hospitals';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-toastify';

interface Props {
  hospital: Hospital;
  allSpecialties: string[];
  onClose: () => void;
  onUpdated: (updated: Hospital) => void;
}

const HospitalEditModal = ({ hospital, allSpecialties, onClose, onUpdated }: Props) => {
  const { token } = useAuth();

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
  console.log('✅ Añadiendo:', trimmed);
  if (trimmed && !specialties.includes(trimmed)) {
    setSpecialties((prev) => [...prev, trimmed]);
    setNewSpecialty('');
  }
};


  const handleRemoveSpecialty = (spec: string) => {
    setSpecialties((prev) => prev.filter((s) => s !== spec));
  };

  const handleSubmit = async () => {
    console.log('⏩ Enviando datos:', { ...form, specialties });

    if (!token) return;
    try {
      const updated = await updateHospital(hospital._id, { ...form, specialties }, token);

      onUpdated(updated);
      toast.success('Hospital actualizado correctamente');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar hospital');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Editar hospital</h2>

        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Nombre"
          className="border p-2 rounded w-full mb-2"
        />
        <input
          type="text"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Dirección"
          className="border p-2 rounded w-full mb-2"
        />
        <input
          type="text"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Teléfono"
          className="border p-2 rounded w-full mb-4"
        />

        <div className="mb-4">
          <h3 className="font-medium mb-1">Especialidades</h3>
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
              placeholder="Nueva especialidad"
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
            Hospital abierto
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HospitalEditModal;
