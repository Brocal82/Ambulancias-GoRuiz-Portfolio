import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

const Profile = () => {
  const { token, userId } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ambulanceRole, setAmbulanceRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setName(response.data.name);
        setEmail(response.data.email);
        setAmbulanceRole(response.data.ambulanceRole);
        setLoading(false);
      } catch (error) {
        toast.error('Error al cargar el perfil');
        console.error(error);
      }
    };

    if (token && userId) fetchProfile();
  }, [token, userId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`/users/${userId}`, { name, email }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Perfil actualizado');
    } catch (error) {
      toast.error('Error al actualizar el perfil');
      console.error(error);
    }
  };

  if (loading) return <p className="text-center mt-8">Cargando perfil...</p>;

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Mi Perfil</h2>
      <form onSubmit={handleUpdate} className="space-y-4">
        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className="mt-1 block w-full p-2 border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
          />
        </div>

        {/* Rol Ambulancia */}
        <div>
          <label htmlFor="ambulanceRole" className="block text-sm font-medium text-gray-700">
            Rol en ambulancia
          </label>
          <select
            id="ambulanceRole"
            value={ambulanceRole}
            disabled
            className="mt-1 block w-full p-2 border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
          >
            <option value="driver">Conductor</option>
            <option value="medic">Sanitario</option>
            <option value="both">Ambos</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
};

export default Profile;
