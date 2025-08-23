import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { getUserById, updateUserProfile, deleteUserDocument } from '../api/users';
import { getPscheinStatus } from '../utils/pscheinUtils';
import type { User, AmbulanceRole } from '../types/user';
import { useTranslation } from 'react-i18next';

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { t } = useTranslation();

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
        setMessage(t('pages.profile.messages.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, userIdFromAuthContext, token, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const idToUpdate = userId || userIdFromAuthContext;
    if (!idToUpdate || !token) return;

    try {
      let uploadedProfileImage: string | undefined;

      // Si hay archivos que subir
      if (profileImageFile || documentsFiles) {
        const form = new FormData();
        if (profileImageFile) form.append('profileImage', profileImageFile);
        if (documentsFiles) {
          Array.from(documentsFiles).forEach((doc) => {
            form.append('documents', doc);
          });
        }

        // Subimos archivos
        const uploadRes = await fetch('http://localhost:5000/api/users/me/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        const uploadData = await uploadRes.json();
        if (uploadData?.profileImage) {
          uploadedProfileImage = uploadData.profileImage;
        }
      }

      // Mezclamos con posible imagen nueva
      const finalFormData = {
        ...formData,
        profileImage: uploadedProfileImage || formData.profileImage,
      };

      await updateUserProfile(idToUpdate, finalFormData, token);

      // Refrescamos datos
      const updatedUser = await getUserById(token, idToUpdate);
      setFormData(updatedUser);

      // Actualizamos contexto si es el propio usuario
      if (idToUpdate === userIdFromAuthContext) {
        login(token, idToUpdate, role || 'worker', updatedUser);
      }

      toast.success(t('pages.profile.messages.saved'));

      setTimeout(() => {
        navigate(role === 'admin' ? '/admin' : '/worker');
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error(t('pages.profile.messages.saveError'));
    }
  };

  const handleDeleteDocument = async (filePath: string) => {
    if (!token) return;

    try {
      const result = await deleteUserDocument(filePath, token);
      toast.success(t('pages.profile.messages.docDeleted'));
      setFormData((prev) => ({
        ...prev,
        documents: result.documents,
      }));
    } catch (error) {
      console.error(error);
      toast.error(t('pages.profile.messages.docDeleteError'));
    }
  };

  // Eliminar imagen de perfil
  const handleDeleteProfileImage = async () => {
    if (
      !token ||
      !userIdFromAuthContext ||
      !formData.name ||
      !formData.lastName ||
      !formData.email
    ) {
      toast.error(t('pages.profile.messages.missingRequired'));
      return;
    }

    try {
      const updatedUser = await updateUserProfile(
        userIdFromAuthContext,
        {
          name: formData.name,
          lastName: formData.lastName,
          email: formData.email,
          ambulanceRole: formData.ambulanceRole,
          address: formData.address,
          phone: formData.phone,
          emergencyPhone: formData.emergencyPhone,
          pscheinExpiry: formData.pscheinExpiry,
          profileImage: '',
        },
        token
      );

      setFormData(updatedUser);
      login(token, userIdFromAuthContext, role || 'worker', updatedUser);

      toast.success(t('pages.profile.messages.removeImageSuccess'));
    } catch (error) {
      console.error('❌ Error al eliminar imagen de perfil:', error);
      toast.error(t('pages.profile.messages.removeImageError'));
    }
  };

  if (loading) return <p className="p-4">{t('pages.profile.loading')}</p>;

  const pscheinStatus = getPscheinStatus(formData.pscheinExpiry);
  const roles: AmbulanceRole[] = ['medic', 'driver', 'both'];

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-6 text-center">{t('pages.profile.title')}</h2>
      {message && <p className="mb-4 text-sm text-blue-600">{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 📸 Imagen + nombre + apellidos */}
        <div className="flex items-start gap-4 mb-6">
          {/* Imagen de perfil (1/3) */}
          <div className="w-1/3 flex flex-col items-center gap-2">
            <label
              htmlFor="profileImageUpload"
              className="cursor-pointer group"
              title={t('pages.profile.image.changeTitle')}
            >
              <img
                src={
                  previewImage
                    ? previewImage
                    : formData.profileImage?.startsWith('/uploads/')
                      ? `http://localhost:5000${formData.profileImage}`
                      : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                }
                alt={t('pages.profile.image.alt')}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border border-gray-300 group-hover:opacity-80 transition"
              />
            </label>

            {/* Botón para quitar imagen */}
            {formData.profileImage && (
              <button
                type="button"
                onClick={handleDeleteProfileImage}
                className="text-red-500 hover:text-red-700 text-xs"
                title={t('pages.profile.image.removeButtonTitle')}
              >
                {t('pages.profile.image.remove')}
              </button>
            )}

            {/* Input oculto */}
            <input
              type="file"
              id="profileImageUpload"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setProfileImageFile(file);
                if (file) {
                  setPreviewImage(URL.createObjectURL(file));
                }
              }}
              className="hidden"
              title={t('pages.profile.image.changeTitle')}
            />
          </div>

          {/* Nombre y Apellidos (2/3) */}
          <div className="w-2/3 space-y-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                {t('pages.profile.labels.name')}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                className="w-full border rounded p-2"
                placeholder={t('pages.profile.placeholders.name')}
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                {t('pages.profile.labels.lastName')}
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleChange}
                className="w-full border rounded p-2"
                placeholder={t('pages.profile.placeholders.lastName')}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('pages.profile.labels.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                disabled
                className="w-full border rounded p-2 bg-gray-100 text-gray-700 cursor-not-allowed"
                title={t('pages.profile.image.emailLocked')}
              />
            </div>
          </div>
        </div>

        {/* Rol en ambulancia */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {t('pages.profile.labels.ambulanceRole')}
          </label>
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
                  ? t('pages.profile.roles.driver')
                  : currentRole === 'medic'
                  ? t('pages.profile.roles.medic')
                  : t('pages.profile.roles.both')}
              </button>
            ))}
          </div>
        </div>

        {/* P-Schein */}
        {(formData.ambulanceRole === 'driver' || formData.ambulanceRole === 'both') && (
          <>
            <label htmlFor="pscheinExpiry" className="block text-sm font-medium text-gray-700">
              {t('pages.profile.labels.pscheinExpiry')}
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
              <p className="text-red-600 text-sm mt-1">{t('pages.profile.pschein.expired')}</p>
            )}
            {pscheinStatus === 'warning' && (
              <p className="text-orange-600 text-sm mt-1">{t('pages.profile.pschein.warning')}</p>
            )}
          </>
        )}

        {/* Dirección */}
        <div className="space-y-1">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            {t('pages.profile.labels.address')}
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder={t('pages.profile.placeholders.address')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Teléfono */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              {t('pages.profile.labels.phone')}
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              className="w-full border rounded p-2"
              placeholder={t('pages.profile.placeholders.phone')}
            />
          </div>

          {/* Teléfono de emergencia */}
          <div>
            <label htmlFor="emergencyPhone" className="block text-sm font-medium text-gray-700">
              {t('pages.profile.labels.emergencyPhone')}
            </label>
            <input
              type="text"
              id="emergencyPhone"
              name="emergencyPhone"
              value={formData.emergencyPhone || ''}
              onChange={handleChange}
              className="w-full border rounded p-2"
              placeholder={t('pages.profile.placeholders.emergencyPhone')}
            />
          </div>
        </div>

        {/* Documentos PDF */}
        <div className="space-y-1 mt-4">
  <label htmlFor="documentsUpload" className="block text-sm font-medium text-gray-700">
    {t('pages.profile.labels.documents')}
  </label>

  {/* input oculto */}
  <input
    type="file"
    id="documentsUpload"
    accept="application/pdf"
    multiple
    onChange={(e) => setDocumentsFiles(e.target.files)}
    className="sr-only"
  />

  {/* botón personalizado */}
  <label
    htmlFor="documentsUpload"
    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700"
  >
    ⬆️ {t('pages.profile.documents.upload')}
  </label>

  {/* muestra selección actual */}
  {documentsFiles && documentsFiles.length > 0 ? (
    <ul className="mt-2 list-disc list-inside text-sm text-gray-700">
      {Array.from(documentsFiles).map((f) => (
        <li key={f.name}>{f.name}</li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-sm text-gray-500">
      {t('pages.profile.documents.noneSelected')}
    </p>
  )}
</div>



        {formData.documents && formData.documents.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 font-medium mb-1">
              {t('pages.profile.labels.uploadedDocs')}
            </p>
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
                      {t('pages.profile.documents.view')}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(docUrl)}
                    className="text-red-500 hover:text-red-700 text-sm ml-2"
                    title={t('pages.profile.documents.deleteTitle')}
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
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 mt-4"
        >
          {t('pages.profile.actions.save')}
        </button>
      </form>
    </div>
  );
};

export default Profile;
