import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserById, updateUserProfile } from '../api/users';
import { getPscheinStatus } from '../utils/pscheinUtils';
import type { User, AmbulanceRole } from '../types/user';

const Profile = () => {
  const { userId, token } = useAuth();
  const [formData, setFormData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!userId || !token) return;
      try {
        const user = await getUserById(userId, token);
        setFormData(user);
      } catch (error) {
        console.error(error);
        setMessage('Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !token) return;
    try {
      await updateUserProfile(userId, formData, token);
      setMessage('Perfil actualizado correctamente');
    } catch (error) {
      console.error(error);
      setMessage('Error al guardar el perfil');
    }
  };

  if (loading) return <p className="p-4">Cargando...</p>;

  const pscheinStatus = getPscheinStatus(formData.pscheinExpiry);
  const roles: AmbulanceRole[] = ['medic', 'driver', 'both'];

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Perfil de Usuario</h2>
      {message && <p className="mb-4 text-sm text-blue-600">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Rol en ambulancia</label>
        <div className="flex justify-between gap-2">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setFormData({ ...formData, ambulanceRole: role })}
              className={`flex-1 px-4 py-2 border rounded ${
                formData.ambulanceRole === role
                  ? 'bg-green-500 text-white border-green-600'
                  : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              {role === 'driver'
                ? '🚑 Conductor'
                : role === 'medic'
                ? '🩺 Sanitario'
                : '🟰 Ambos'}
            </button>
          ))}
        </div>

        {(formData.ambulanceRole === 'driver' || formData.ambulanceRole === 'both') && (
          <>
            <label htmlFor="pscheinExpiry" className="block text-sm font-medium text-gray-700">
              Fecha de caducidad del P-Schein
            </label>
            <input
              type="date"
              id="pscheinExpiry"
              name="pscheinExpiry"
              value={formData.pscheinExpiry || ''}
              onChange={handleChange}
              className={`w-full border rounded p-2 ${
                pscheinStatus === 'expired'
                  ? 'border-red-500'
                  : pscheinStatus === 'warning'
                  ? 'border-orange-400'
                  : 'border-gray-300'
              }`}
            />

            {pscheinStatus === 'expired' && (
              <p className="text-red-600 text-sm mt-1">❌ El P-Schein está caducado</p>
            )}
            {pscheinStatus === 'warning' && (
              <p className="text-orange-600 text-sm mt-1">⚠️ El P-Schein caduca en menos de 6 meses</p>
            )}
          </>
        )}

        <input
          type="text"
          name="address"
          value={formData.address || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Dirección"
        />

        <input
          type="text"
          name="phone"
          value={formData.phone || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Teléfono"
        />

        <input
          type="text"
          name="emergencyPhone"
          value={formData.emergencyPhone || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Teléfono de emergencia"
        />

        <input
          type="text"
          name="profileImage"
          value={formData.profileImage || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="URL de la foto de perfil (opcional)"
        />

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
};

export default Profile;
