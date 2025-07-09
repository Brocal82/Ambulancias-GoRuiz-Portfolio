import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { getUserById, updateUserProfile } from '../api/users';
import { getPscheinStatus } from '../utils/pscheinUtils';
import type { User, AmbulanceRole } from '../types/user';


interface ProfileProps {
  userId?: string; // <-- Añadido
}

const Profile = ({ userId }: ProfileProps) => {
  const { userId: userIdFromAuthContext, token, role, login } = useAuth(); // renombrado userId
  const [formData, setFormData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

useEffect(() => {
  setLoading(true);  // <--- Reinicia loading cada vez que cambia el userId
  const fetchData = async () => {
    if (!token) return;

    const idToFetch = userId || userIdFromAuthContext;
    if (!idToFetch) return;

    try {
      const fetchedUser = await getUserById(token, idToFetch);

      setFormData(fetchedUser);
    } catch (error) {
      console.error(error);
      setMessage('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [userId, userIdFromAuthContext, token]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

const navigate = useNavigate(); // ⬅️ Antes del handleSubmit

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // El id puede venir del prop 'userId' (admin viendo otro usuario) o del contexto de auth (usuario logueado)
  const idToUpdate = userId || userIdFromAuthContext; // userIdFromAuthContext debe venir de useAuth() o prop

  if (!idToUpdate || !token) return;

  try {
    await updateUserProfile(idToUpdate, formData, token);

    // Obtener el usuario actualizado para refrescar el formulario
    const updatedUser = await getUserById(token, idToUpdate);

    setFormData(updatedUser);

    login(token, idToUpdate, role || 'worker', updatedUser);

    toast.success('✅ Cambios guardados correctamente');

    setTimeout(() => {
      navigate(role === 'admin' ? '/admin' : '/worker');
    }, 100);
  } catch (error) {
    console.error(error);
    toast.error('❌ Error al guardar el perfil');
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
        {/* Nombre */}
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nombre
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Tu nombre"
        />

        {/* Apellidos */}
        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
          Apellidos
        </label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={formData.lastName || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Tus apellidos"
        />

        {/* Rol en ambulancia */}
        <label className="block text-sm font-medium text-gray-700">Rol en ambulancia</label>
        <div className="flex justify-between gap-2">
          {roles.map((currentRole) => (
            <button
              key={currentRole}
              type="button"
              onClick={() => setFormData({ ...formData, ambulanceRole: currentRole })}
              className={`flex-1 px-4 py-2 border rounded ${
                formData.ambulanceRole === currentRole
                  ? 'bg-green-500 text-white border-green-600'
                  : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              {currentRole === 'driver'
                ? '🚑 Conductor'
                : currentRole === 'medic'
                ? '🩺 Sanitario'
                : '🟰 Ambos'}
            </button>
          ))}
        </div>

        {/* P-Schein */}
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

        {/* Dirección */}
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Dirección
        </label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.address || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Calle y número"
        />

        {/* Teléfono */}
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Teléfono
        </label>
        <input
          type="text"
          id="phone"
          name="phone"
          value={formData.phone || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Número de teléfono"
        />

        {/* Teléfono de emergencia */}
        <label htmlFor="emergencyPhone" className="block text-sm font-medium text-gray-700">
          Teléfono de emergencia
        </label>
        <input
          type="text"
          id="emergencyPhone"
          name="emergencyPhone"
          value={formData.emergencyPhone || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Número de contacto en caso de emergencia"
        />

        {/* Foto de perfil */}
        <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700">
          URL de la foto de perfil
        </label>
        <input
          type="text"
          id="profileImage"
          name="profileImage"
          value={formData.profileImage || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="URL de imagen (opcional)"
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
