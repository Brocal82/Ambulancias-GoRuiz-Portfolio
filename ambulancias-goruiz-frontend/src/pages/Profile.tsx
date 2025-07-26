import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { getUserById, updateUserProfile, deleteUserDocument } from '../api/users';
import { getPscheinStatus } from '../utils/pscheinUtils';
import type { User, AmbulanceRole } from '../types/user';

interface ProfileProps {
  userId?: string;
}

const Profile = ({ userId }: ProfileProps) => {
  const { userId: userIdFromAuthContext, token, role, login } = useAuth();
  const [formData, setFormData] = useState<Partial<User>>({});
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [documentsFiles, setDocumentsFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const idToUpdate = userId || userIdFromAuthContext;
    if (!idToUpdate || !token) return;

    try {
      // Si hay archivos que subir
      if (profileImageFile || documentsFiles) {
        const form = new FormData();
        if (profileImageFile) form.append('profileImage', profileImageFile);
        if (documentsFiles) {
          Array.from(documentsFiles).forEach((doc) => {
            form.append('documents', doc);
          });
        }

        // 🟢 Subimos archivos y leemos la respuesta
        const uploadRes = await fetch('http://localhost:5000/api/users/me/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        });

        const uploadData = await uploadRes.json();
        console.log("🖼️ Imagen subida:", uploadData.profileImage);

        // ✅ Actualizamos el formData con la nueva imagen (si viene)
        if (uploadData?.profileImage) {
          setFormData((prev) => ({ ...prev, profileImage: uploadData.profileImage }));
        }
      }

      // Guardamos el resto del perfil (campos de texto)
      await updateUserProfile(idToUpdate, formData, token);

      // Volvemos a pedir los datos del usuario actualizado
      const updatedUser = await getUserById(token, idToUpdate);
      setFormData(updatedUser);

      // Actualizamos el contexto para refrescar header
      if (idToUpdate === userIdFromAuthContext) {
        login(token, idToUpdate, role || 'worker', updatedUser);
      }

      toast.success('✅ Cambios guardados correctamente');

      setTimeout(() => {
        navigate(role === 'admin' ? '/admin' : '/worker');
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error('❌ Error al guardar el perfil');
    }
  };

  const handleDeleteDocument = async (filePath: string) => {
    if (!token) return;

    try {
      const result = await deleteUserDocument(filePath, token);

      toast.success('✅ Documento eliminado');

      setFormData((prev) => ({
        ...prev,
        documents: result.documents,
      }));
    } catch (error) {
      console.error(error);
      toast.error('❌ No se pudo eliminar el documento');
    }
  };

// 🧹 Elimina la imagen de perfil del usuario tanto del frontend como del backend.
// Esta función se puede usar para permitir que el usuario borre su foto actual.
// Actualmente no se está usando. Puedes integrarla en el futuro si añades un botón "Eliminar imagen".
// const handleDeleteProfileImage = async () => {
//   const idToUpdate = userId || userIdFromAuthContext;

//   if (!idToUpdate || !token) return;

//   try {
//     const updatedUser = await updateUserProfile(
//   idToUpdate,
//   {
//     name: formData.name || '',
//     email: formData.email || '',
//     profileImage: '',
//   },
//   token
// );

//     toast.success('✅ Imagen de perfil eliminada');
//     setFormData(updatedUser);

//     if (idToUpdate === userIdFromAuthContext) {
//       login(token, idToUpdate, role || 'worker', updatedUser);
//     }
//   } catch (error) {
//     console.error(error);
//     toast.error('❌ No se pudo eliminar la imagen de perfil');
//   }
// };






  if (loading) return <p className="p-4">Cargando...</p>;

  const pscheinStatus = getPscheinStatus(formData.pscheinExpiry);
  const roles: AmbulanceRole[] = ['medic', 'driver', 'both'];

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Perfil de Usuario</h2>
      {message && <p className="mb-4 text-sm text-blue-600">{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre */}
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
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
        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Apellidos</label>
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
              className={`flex-1 px-4 py-2 border rounded ${formData.ambulanceRole === currentRole
                  ? 'bg-green-500 text-white border-green-600'
                  : 'bg-white text-gray-800 border-gray-300'
                }`}
            >
              {currentRole === 'driver' ? '🚑 Conductor' : currentRole === 'medic' ? '🩺 Sanitario' : '🟰 Ambos'}
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
              className={`w-full border rounded p-2 ${pscheinStatus === 'expired'
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
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">Dirección</label>
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
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono</label>
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
        <label htmlFor="emergencyPhone" className="block text-sm font-medium text-gray-700">Teléfono de emergencia</label>
        <input
          type="text"
          id="emergencyPhone"
          name="emergencyPhone"
          value={formData.emergencyPhone || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          placeholder="Número de contacto en caso de emergencia"
        />

        {/* 👇 Inputs nuevos para seleccionar archivos */}
        <label htmlFor="profileImageUpload" className="block text-sm font-medium text-gray-700">
          Cambiar imagen de perfil
        </label>
        <input
          type="file"
          id="profileImageUpload"
          accept="image/*"
          onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
          className="w-full border rounded p-2"
        />

        <label htmlFor="documentsUpload" className="block text-sm font-medium text-gray-700 mt-4">
          Subir documentos (PDF)
        </label>
        <input
          type="file"
          id="documentsUpload"
          accept="application/pdf"
          multiple
          onChange={(e) => setDocumentsFiles(e.target.files)}
          className="w-full border rounded p-2"
        />

       


        {formData.documents && formData.documents.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 font-medium mb-1">📄 Documentos subidos:</p>
            <ul className="pl-2 text-sm text-gray-700 space-y-1">
              {formData.documents.map((docUrl, index) => (
                <li key={index} className="flex items-center justify-between">
                  <div>
                    {docUrl.split('/').pop()}
                    <a
                      href={`http://localhost:5000${docUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline ml-2"
                    >
                      Ver documento
                    </a>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(docUrl)}
                    className="text-red-500 hover:text-red-700 text-sm ml-2"
                    title="Eliminar documento"
                  >
                    ❌
                  </button>
                </li>
              ))}

            </ul>
          </div>
        )}


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
