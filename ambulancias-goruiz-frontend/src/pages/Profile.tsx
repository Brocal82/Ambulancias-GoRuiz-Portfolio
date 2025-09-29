import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toastT } from '../utils/toast';
import { useAuth } from '../hooks/useAuth';
import { getUserById, updateUserProfile, deleteUserDocument, deleteUser } from '../api/users';
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

      toastT.success(['toasts.profile.saveSuccess']);

      setTimeout(() => {
        navigate(role === 'admin' ? '/admin' : '/worker');
      }, 100);
    } catch (error) {
      console.error(error);
      toastT.error(['toasts.profile.saveError']);
    }
  };

  const handleDeleteDocument = async (filePath: string) => {
    if (!token) return;

    try {
      const result = await deleteUserDocument(filePath, token);
      toastT.success(['toasts.profile.docDeleted']);
      setFormData((prev) => ({
        ...prev,
        documents: result.documents,
      }));
    } catch (error) {
      console.error(error);
      toastT.error(['toasts.profile.docDeleteError']);
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
      toastT.error(['toasts.profile.missingRequired']);
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

      toastT.success(['toasts.profile.imageDeleted']);
    } catch (error) {
      console.error('❌ Error al eliminar imagen de perfil:', error);
      toastT.error(['toasts.profile.imageDeleteError']);
    }
  };

  if (loading) return <p className="p-4">{t('pages.profile.loading')}</p>;
  // 🗑️ Eliminar usuario (solo admin; evita auto-eliminarse)

  const handleDeleteUser = async () => {
    const targetId = userId || userIdFromAuthContext;
    if (!token || !role || !targetId) return;

    if (targetId === userIdFromAuthContext) {
      toastT.error(['toasts.profile.cannotDeleteSelf']);
      return;
    }

    const fullname =
      `${formData.lastName ?? ''} ${formData.name ?? ''}`.trim() ||
      t('pages.profile.labels.user');

    const confirmed = window.confirm(
      t('pages.profile.messages.confirmDelete', { name: fullname })
    );
    if (!confirmed) return;

    try {
      await deleteUser(targetId, token);
      toastT.success(['toasts.profile.deleteSuccess']);
      navigate('/admin'); // ajusta si tu listado está en otra ruta
    } catch (error) {
      console.error(error);
      toastT.error(['toasts.profile.deleteError']);
    }
  };

  const pscheinStatus = getPscheinStatus(formData.pscheinExpiry);
  const roles: AmbulanceRole[] = ['medic', 'driver', 'both'];

  return (

    <div className="mx-auto max-w-xl px-4 sm:px-5 py-5 rounded-2xl bg-white shadow ring-1 ring-slate-200">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-4 text-center">
        {t('pages.profile.title')}
      </h2>

      {message && (
        <p className="mb-3 text-xs text-blue-600 text-center">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header compacto: avatar + nombre/apellidos/email */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-1">
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
                className="w-20 h-20 rounded-full object-cover ring-1 ring-slate-200 bg-white shadow-sm group-hover:opacity-90 transition"
              />
            </label>

            {formData.profileImage && (
              <button
                type="button"
                onClick={handleDeleteProfileImage}
                className="text-red-600 hover:text-red-700 text-[11px] leading-none"
                title={t('pages.profile.image.removeButtonTitle')}
              >
                {t('pages.profile.image.remove')}
              </button>
            )}

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

          {/* Nombre / Apellidos / Email en grid compacto */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div className="col-span-1">
              <label htmlFor="name" className="block text-xs font-medium text-slate-700">
                {t('pages.profile.labels.name')}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                placeholder={t('pages.profile.placeholders.name')}
              />
            </div>

            <div className="col-span-1">
              <label htmlFor="lastName" className="block text-xs font-medium text-slate-700">
                {t('pages.profile.labels.lastName')}
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                placeholder={t('pages.profile.placeholders.lastName')}
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="email" className="block text-xs font-medium text-slate-700">
                {t('pages.profile.labels.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 cursor-not-allowed"
                title={t('pages.profile.image.emailLocked')}
              />
            </div>
          </div>
        </div>

        {/* Rol en ambulancia: chips compactos */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700">
            {t('pages.profile.labels.ambulanceRole')}
          </label>
          <div className="flex flex-wrap gap-2">
            {roles.map((currentRole) => (
              <button
                key={currentRole}
                type="button"
                onClick={() => setFormData({ ...formData, ambulanceRole: currentRole })}
                className={`px-3 py-1.5 text-xs rounded-xl transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${formData.ambulanceRole === currentRole
                    ? 'bg-blue-600 text-white shadow-md -translate-y-0.5'
                    : 'bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200 shadow-sm'
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

        {/* P-Schein compacto */}
        {(formData.ambulanceRole === 'driver' || formData.ambulanceRole === 'both') && (
          <div className="space-y-1">
            <label htmlFor="pscheinExpiry" className="block text-xs font-medium text-slate-700">
              {t('pages.profile.labels.pscheinExpiry')}
            </label>
            <input
              type="date"
              id="pscheinExpiry"
              name="pscheinExpiry"
              value={formData.pscheinExpiry || ''}
              onChange={handleChange}
              className={`w-full rounded-lg px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 ${pscheinStatus === 'expired'
                  ? 'border border-red-500 focus:ring-red-100'
                  : pscheinStatus === 'warning'
                    ? 'border border-orange-400 focus:ring-orange-100'
                    : 'border border-slate-300 focus:ring-blue-100 focus:border-blue-400'
                }`}
            />
            {pscheinStatus === 'expired' && (
              <p className="text-red-600 text-xs mt-0.5">{t('pages.profile.pschein.expired')}</p>
            )}
            {pscheinStatus === 'warning' && (
              <p className="text-orange-600 text-xs mt-0.5">{t('pages.profile.pschein.warning')}</p>
            )}
          </div>
        )}

        {/* Dirección */}
        <div className="space-y-1">
          <label htmlFor="address" className="block text-xs font-medium text-slate-700">
            {t('pages.profile.labels.address')}
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
            placeholder={t('pages.profile.placeholders.address')}
          />
        </div>

        {/* Teléfono y emergencia en 2 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-slate-700">
              {t('pages.profile.labels.phone')}
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              placeholder={t('pages.profile.placeholders.phone')}
            />
          </div>

          <div>
            <label htmlFor="emergencyPhone" className="block text-xs font-medium text-slate-700">
              {t('pages.profile.labels.emergencyPhone')}
            </label>
            <input
              type="text"
              id="emergencyPhone"
              name="emergencyPhone"
              value={formData.emergencyPhone || ''}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              placeholder={t('pages.profile.placeholders.emergencyPhone')}
            />
          </div>
        </div>

        {/* Documentos PDF compactos */}
        <div className="space-y-1">
          <label htmlFor="documentsUpload" className="block text-xs font-medium text-slate-700">
            {t('pages.profile.labels.documents')}
          </label>

          <input
            type="file"
            id="documentsUpload"
            accept="application/pdf"
            multiple
            onChange={(e) => setDocumentsFiles(e.target.files)}
            className="sr-only"
          />

          <label
            htmlFor="documentsUpload"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            ⬆️ {t('pages.profile.documents.upload')}
          </label>

          {documentsFiles && documentsFiles.length > 0 ? (
            <ul className="mt-1 list-disc list-inside text-xs text-slate-700">
              {Array.from(documentsFiles).map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {t('pages.profile.documents.noneSelected')}
            </p>
          )}
        </div>

        {formData.documents && formData.documents.length > 0 && (
          <div className="mt-1">
            <p className="text-xs text-slate-600 font-medium mb-1">
              {t('pages.profile.labels.uploadedDocs')}
            </p>
            <ul className="pl-2 text-xs text-slate-700 space-y-1">
              {formData.documents.map((docUrl, index) => (
                <li key={index} className="flex items-center justify-between">
                  <div className="truncate">
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
                    className="text-red-600 hover:text-red-700 text-xs ml-2"
                    title={t('pages.profile.documents.deleteTitle')}
                  >
                    ❌
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Guardar */}
        <button
          type="submit"
          className="w-full mt-4 inline-flex justify-center items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          {t('pages.profile.actions.save')}
        </button>

        {/* Danger Zone (solo admin, al editar a otro) */}
        {role === 'admin' && userId && userId !== userIdFromAuthContext && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3">
            <h3 className="text-xs font-semibold text-red-700 mb-1">
              {t('pages.profile.danger.title')}
            </h3>
            <p className="text-xs text-red-700/90 mb-2">
              {t('pages.profile.danger.description')}
            </p>
            <button
              type="button"
              onClick={handleDeleteUser}
              className="w-full inline-flex justify-center items-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
            >
              {t('pages.profile.actions.deleteUser')}
            </button>
          </div>
        )}
      </form>
    </div>
  );

};

export default Profile;
