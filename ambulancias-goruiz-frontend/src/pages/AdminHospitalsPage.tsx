import { useEffect, useState } from 'react';
import { getAllHospitals, updateHospital, createHospital, deleteHospital } from '../api/hospitals';
import type { Hospital } from '../types/hospital';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import Select from 'react-select';

const AdminHospitalsPage = () => {
  const { token } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [searchName, setSearchName] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    specialties: '',
  });

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

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const newHospital = await createHospital(
        {
          name: form.name,
          address: form.address,
          phone: form.phone,
          specialties: form.specialties.split(',').map((s) => s.trim()),
          isOpen: true,
        },
        token
      );
      setHospitals((prev) => [...prev, newHospital]);
      toast.success('Hospital añadido correctamente');
      setForm({ name: '', address: '', phone: '', specialties: '' });
      setShowForm(false);
    } catch (error) {
      console.error(error);
      toast.error('Error al añadir hospital');
    }
  };

  const handleDeleteHospital = async (id: string) => {
    if (!token) return;
    if (!confirm('¿Estás seguro de que quieres eliminar este hospital?')) return;

    try {
      await deleteHospital(id, token);
      setHospitals((prev) => prev.filter((h) => h._id !== id));
      toast.success('Hospital eliminado');
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar hospital');
    }
  };

  const specialties = Array.from(
    new Set(hospitals.flatMap((h) => h.specialties))
  );

  const filteredHospitals = hospitals.filter((h) => {
    const matchesSpecialty =
      selectedSpecialty === 'all' || h.specialties.includes(selectedSpecialty);
    const matchesName = h.name.toLowerCase().includes(searchName.toLowerCase());
    return matchesSpecialty && matchesName;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">Gestión de hospitales</h1>

      <div className="flex flex-col gap-4 max-w-sm mx-auto mb-6">
        <div>
          <label htmlFor="hospitalNameSearch" className="block text-sm font-medium mb-1">
            Buscar por nombre:
          </label>
          <input
            id="hospitalNameSearch"
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Escribe el nombre del hospital"
            className="border p-2 rounded w-full bg-white shadow-sm"
          />
        </div>

        <div>
          <label htmlFor="specialtyFilter" className="block text-sm font-medium mb-1">
            Filtrar por especialidad:
          </label>
          <Select
            id="specialtyFilter"
            options={[
              { value: 'all', label: 'Todas las especialidades' },
              ...specialties.map((spec) => ({ value: spec, label: spec })),
            ]}
            value={
              selectedSpecialty === 'all'
                ? { value: 'all', label: 'Todas las especialidades' }
                : { value: selectedSpecialty, label: selectedSpecialty }
            }
            onChange={(option) => setSelectedSpecialty(option?.value || 'all')}
            className="text-sm"
            classNamePrefix="react-select"
            placeholder="Selecciona una especialidad"
            isSearchable
          />
        </div>


        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition mt-2"
        >
          {showForm ? 'Cancelar' : '➕ Añadir hospital'}
        </button>

        {showForm && (
          <form onSubmit={handleAddHospital} className="bg-white p-4 rounded shadow space-y-3">
            <input
              type="text"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border p-2 rounded w-full"
              required
            />
            <input
              type="text"
              placeholder="Dirección"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="border p-2 rounded w-full"
              required
            />
            <input
              type="text"
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border p-2 rounded w-full"
              required
            />
            <input
              type="text"
              placeholder="Especialidades (coma separadas)"
              value={form.specialties}
              onChange={(e) => setForm({ ...form, specialties: e.target.value })}
              className="border p-2 rounded w-full"
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              Guardar hospital
            </button>
          </form>
        )}
      </div>

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
            <button
              onClick={() => handleDeleteHospital(hospital._id)}
              className="text-red-600 text-sm underline self-end mt-2 hover:text-red-800"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminHospitalsPage;
