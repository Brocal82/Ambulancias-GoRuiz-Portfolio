// frontend/src/pages/Profile.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toastT } from "../../../utils/toast";
import { useAuth } from "../../../hooks/useAuth";
import * as UsersApi from "../domain/api";

import { getPscheinInfo } from "../../../utils/pscheinUtils";
import type { User, AmbulanceRole } from "../domain/types";

import { useTranslation } from "react-i18next";
import { buildImageUrl } from "../../../utils/apiOrigins";
import FileUpload from "../../../components/common/FileUpload";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";
import DangerDeleteButton from "../../../components/common/actions/DangerDeleteButton";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";
import { displayFileNameFromUrl } from "../../../utils/fileName";
import type { UpdateUserPayload } from "../domain/payloads";



interface ProfileProps {
  userId?: string;
}

const Profile = ({ userId }: ProfileProps) => {
  const { userId: userIdFromAuthContext, token, role, login } = useAuth();
  const [formData, setFormData] = useState<Partial<User>>({});
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [documentsFiles, setDocumentsFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { t } = useTranslation();

  const navigate = useNavigate();

  const isAdminEditingOtherUser = role === "admin" && Boolean(userId);

  useEffect(() => {
    setLoading(true);

    const fetchData = async () => {
      if (!token) return;

      const idToFetch = userId || userIdFromAuthContext;
      if (!idToFetch) return;

      try {
        const fetchedUser = await UsersApi.getUserById(idToFetch);
        setFormData(fetchedUser);
      } catch (error) {
        console.error(error);
        toastT.error(["pages.profile.messages.loadError"]);
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
      let uploadedProfileImage: string | undefined;

      if (profileImageFile || documentsFiles) {
        const uploadData =
          idToUpdate === userIdFromAuthContext
            ? await UsersApi.uploadUserFiles({
                profileImage: profileImageFile,
                documents: documentsFiles,
              })
            : await UsersApi.uploadUserFilesForUser(idToUpdate, {
                profileImage: profileImageFile,
                documents: documentsFiles,
              });

        if (uploadData?.profileImage) {
          uploadedProfileImage = uploadData.profileImage;
        }
      }

      const payload: UpdateUserPayload = {
        name: formData.name || "",
        lastName: formData.lastName || "",
        email: formData.email || "",
        ambulanceRole: formData.ambulanceRole,
        address: formData.address,
        phone: formData.phone,
        emergencyPhone: formData.emergencyPhone,
        pscheinExpiry: formData.pscheinExpiry,
        profileImage: uploadedProfileImage || formData.profileImage,
        ...(isAdminEditingOtherUser
          ? { employeeNumber: (formData.employeeNumber ?? "").trim() }
          : {}),
      };

      // ✅ Validación mínima (evita mandar strings vacíos)
      if (!payload.name || !payload.lastName || !payload.email) {
        toastT.error(["pages.profile.messages.missingRequired"]);
        return;
      }

      await UsersApi.updateUserProfile(idToUpdate, payload);


      // Refrescamos datos
      const updatedUser = await UsersApi.getUserById(idToUpdate);

      setFormData(updatedUser);

      // ✅ Limpiamos la selección local de documentos tras guardar
      setDocumentsFiles(null);


      // Actualizamos contexto si es el propio usuario
      if (idToUpdate === userIdFromAuthContext) {
        login(token, idToUpdate, role || "worker", updatedUser);
      }

      toastT.success("toasts.profile.saveSuccess");
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.profile.saveError"]);
    }
  };

  const handleDeleteDocument = async (filePath: string) => {
    if (!token) return;

    const idToUpdate = userId || userIdFromAuthContext;
    if (!idToUpdate) return;

    if (
      !window.confirm("¿Estás seguro de que quieres eliminar este documento?")
    ) {
      return;
    }

    try {
      const result =
        idToUpdate === userIdFromAuthContext
          ? await UsersApi.deleteUserDocument(filePath)
          : await UsersApi.deleteUserDocumentForUser(idToUpdate, filePath);

      toastT.success("toasts.profile.docDeleted");
      setFormData((prev) => ({
        ...prev,
        documents: result.documents,
      }));
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.profile.docDeleteError"]);
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
      toastT.error("toasts.profile.missingRequired");
      return;
    }

    try {
      const updatedUser = await UsersApi.updateUserProfile(
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
          profileImage: "",
        },
      );

      setFormData(updatedUser);
      login(token, userIdFromAuthContext, role || "worker", updatedUser);

      toastT.success("toasts.profile.imageDeleted");
    } catch (error) {
      console.error("❌ Error al eliminar imagen de perfil:", error);
      toastT.error(["toasts.profile.imageDeleteError"]);
    }
  };

  if (loading) return <p className="p-4">{t("pages.profile.loading")}</p>;

  // 🗑️ Eliminar usuario (solo admin; evita auto-eliminarse)
  const handleDeleteUser = async () => {
    const targetId = userId || userIdFromAuthContext;
    if (!token || !role || !targetId) return;

    if (targetId === userIdFromAuthContext) {
      toastT.error(["pages.profile.messages.cannotDeleteSelf"]);
      return;
    }

    const fullname =
      `${formData.lastName ?? ""} ${formData.name ?? ""}`.trim() ||
      t("pages.profile.labels.user");

    const confirmed = window.confirm(
      t("pages.profile.messages.confirmDelete", { name: fullname }),
    );
    if (!confirmed) return;

    try {
      await UsersApi.deleteUser(targetId);
      toastT.success("toasts.profile.deleteSuccess");
      navigate("/admin");
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.profile.deleteError"]);
    }
  };

  const pschein = getPscheinInfo(formData.pscheinExpiry);
  const showPschein =
    formData.ambulanceRole === "driver" || formData.ambulanceRole === "both";

  // 📌 Documentos seleccionados (pendientes de guardar)
  // documentsFiles es FileList | null, lo convertimos a array para poder mapearlo en el render
  const pendingDocs = documentsFiles ? Array.from(documentsFiles) : [];


  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
      <div className="rounded-2xl bg-white shadow ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="relative px-5 py-4 bg-slate-900 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
            {`${formData.lastName ?? ""}, ${formData.name ?? ""}`.trim() || "—"}
          </h2>
          {formData.role === "worker" &&
            formData.employeeNumber?.trim() && (
              <span className="text-orange-400 font-bold text-base tracking-wide">
                {formData.employeeNumber}
              </span>
            )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Front: foto + inputs */}
          <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-5">
            {/* Foto + roles */}
            <div className="flex flex-col items-center gap-3">
              <label
                htmlFor="profileImageUpload"
                className="cursor-pointer group"
                title={t("pages.profile.image.changeTitle")}
              >
                <div className="rounded-2xl p-2 ring-1 ring-slate-200 bg-white shadow-sm">
                  <img
                    src={
                      previewImage
                        ? previewImage
                        : formData.profileImage
                          ? buildImageUrl(formData.profileImage)
                          : "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                    }
                    alt={t("pages.profile.image.alt")}
                    className="w-28 h-28 rounded-xl object-cover bg-white group-hover:opacity-90 transition"
                  />
                </div>
              </label>

              {formData.profileImage && (
                <button
                  type="button"
                  onClick={handleDeleteProfileImage}
                  className="text-red-600 hover:text-red-700 text-[11px] leading-none"
                  title={t("pages.profile.image.removeButtonTitle")}
                >
                  {t("pages.profile.image.remove")}
                </button>
              )}

              <input
                type="file"
                id="profileImageUpload"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setProfileImageFile(file);
                  if (file) setPreviewImage(URL.createObjectURL(file));
                }}
                className="hidden"
                title={t("pages.profile.image.changeTitle")}
              />

              {/* Roles */}
              <div className="w-full">
                <p className="text-[11px] font-medium text-slate-700 text-center mb-1">
                  {t("pages.profile.labels.ambulanceRole")}
                </p>
                <div className="flex items-center justify-center gap-2">
                  {(["medic", "driver", "both"] as AmbulanceRole[]).map(
                    (currentRole) => (
                      <button
                        key={currentRole}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, ambulanceRole: currentRole })
                        }
                        className={`px-2.5 py-1 text-[11px] rounded-full transition
                          focus:outline-none focus:ring-2
                          ${formData.ambulanceRole === currentRole
                            ? "bg-orange-100 text-white shadow ring-2 ring-orange-500 focus:ring-orange-300"
                            : "bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200 focus:ring-blue-100"
                          }`}
                      >
                        {currentRole === "driver"
                          ? t("pages.profile.roles.driver")
                          : currentRole === "medic"
                            ? t("pages.profile.roles.medic")
                            : t("pages.profile.roles.both")}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* ✅ Inputs en 2 columnas (sin duplicar nombre en grande) */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Primera fila: Nombre + Apellidos (+ Número solo admin / otro usuario) */}
                <div
                  className={`grid grid-cols-1 gap-3 md:col-span-2 ${isAdminEditingOtherUser ? "md:grid-cols-3" : "md:grid-cols-2"}`}
                >
                  {/* Nombre */}
                  <div className="space-y-1">
                    <label
                      htmlFor="name"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t("pages.profile.labels.name")}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                      placeholder={t("pages.profile.placeholders.name")}
                    />
                  </div>

                  {/* Apellidos */}
                  <div className="space-y-1">
                    <label
                      htmlFor="lastName"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t("pages.profile.labels.lastName")}
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                      placeholder={t("pages.profile.placeholders.lastName")}
                    />
                  </div>

                  {isAdminEditingOtherUser && (
                    <div className="space-y-1">
                      <label
                        htmlFor="employeeNumber"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Número
                      </label>
                      <input
                        type="text"
                        id="employeeNumber"
                        name="employeeNumber"
                        value={formData.employeeNumber ?? ""}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                      />
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-slate-700"
                  >
                    {t("pages.profile.labels.email")}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email || ""}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 cursor-not-allowed"
                    title={t("pages.profile.image.emailLocked")}
                  />
                </div>

                {/* Teléfono */}
                <div className="space-y-1">
                  <label
                    htmlFor="phone"
                    className="block text-xs font-medium text-slate-700"
                  >
                    {t("pages.profile.labels.phone")}
                  </label>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    value={formData.phone || ""}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    placeholder={t("pages.profile.placeholders.phone")}
                  />
                </div>

                {/* Dirección */}
                <div className="space-y-1">
                  <label
                    htmlFor="address"
                    className="block text-xs font-medium text-slate-700"
                  >
                    {t("pages.profile.labels.address")}
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address || ""}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    placeholder={t("pages.profile.placeholders.address")}
                  />
                </div>

                {/* Teléfono emergencia */}
                <div className="space-y-1">
                  <label
                    htmlFor="emergencyPhone"
                    className="block text-xs font-medium text-slate-700"
                  >
                    {t("pages.profile.labels.emergencyPhone")}
                  </label>
                  <input
                    type="text"
                    id="emergencyPhone"
                    name="emergencyPhone"
                    value={formData.emergencyPhone || ""}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    placeholder={t("pages.profile.placeholders.emergencyPhone")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Documentos + P-Schein + docs subidos: 3 columnas fijas y contenidos centrados */}
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
              {/* Columna 1 */}
              <div className="h-full grid grid-rows-[20px_1fr] gap-2 place-items-center text-center">
                <div className="h-5 flex items-center justify-center">
                  <span className="text-[11px] font-medium text-slate-700">
                    {t("pages.profile.labels.documents")}
                  </span>
                </div>

                <div className="min-h-0 w-full flex justify-center">
                  <div className="w-full max-w-[220px]">
                    <FileUpload
                      id="profile-docs"
                      label={t("pages.profile.documents.upload")}
                      hintWhenEmpty={t("pages.profile.documents.noneSelected")}
                      accept="application/pdf"
                      multiple
                      maxSizeMB={10}
                      onChange={(files) => setDocumentsFiles(files)}
                      onError={(msg) => toastT.warn(msg)}
                      showSelectedList={false}
                      className="flex flex-col items-center text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Columna 2 */}
              <div className="h-full grid grid-rows-[20px_1fr] gap-2 place-items-center text-center">
                <div className="h-5 flex items-center justify-center">
                  <span className="text-[11px] font-medium text-slate-700">
                    {t("pages.profile.labels.pscheinExpiry")}
                  </span>
                </div>

                <div className="min-h-0 w-full flex justify-center">
                  {showPschein ? (
                    <div className="w-full max-w-[220px] flex flex-col items-center">
                      <label htmlFor="pscheinExpiry" className="sr-only">
                        {t("pages.profile.labels.pscheinExpiry")}
                      </label>

                      <input
                        type="date"
                        id="pscheinExpiry"
                        name="pscheinExpiry"
                        value={formData.pscheinExpiry || ""}
                        onChange={handleChange}
                        className={`w-full rounded-lg px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-2 ${getPscheinInfo(formData.pscheinExpiry).status === "expired"
                          ? "border border-red-500 focus:ring-red-100"
                          : getPscheinInfo(formData.pscheinExpiry).status === "warning"
                            ? "border border-orange-400 focus:ring-orange-100"
                            : "border border-slate-300 focus:ring-blue-100 focus:border-blue-400"
                          }`}
                      />

                      {pschein.status === "expired" && (
                        <p className="text-red-600 text-[11px] mt-1 text-center">
                          {t(
                            "pages.profile.pschein.expiredDynamic",
                            "❌ P-Schein caducado hace {{months}} meses",
                            { months: Math.abs(pschein.monthsLeft ?? 0) },
                          )}
                        </p>
                      )}
                      {pschein.status === "warning" && (
                        <p className="text-orange-600 text-[11px] mt-1 text-center">
                          {t(
                            "pages.profile.pschein.warningDynamic",
                            "⚠️ Expira en {{months}} meses ({{days}} días)",
                            {
                              months: pschein.monthsLeft ?? 0,
                              days: pschein.daysLeft ?? 0,
                            },
                          )}
                        </p>
                      )}
                      {pschein.status === "valid" && (
                        <p className="text-emerald-600 text-[11px] mt-1 text-center">
                          {t(
                            "pages.profile.pschein.validDynamic",
                            "✅ Válido ({{months}} meses restantes)",
                            { months: pschein.monthsLeft ?? 0 },
                          )}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="hidden lg:block" />
                  )}
                </div>
              </div>

              {/* Columna 3 */}
              <div className="h-full grid grid-rows-[20px_1fr] gap-2 place-items-center text-center">
                <div className="h-5 flex items-center justify-center">
                  <span className="text-[11px] font-medium text-slate-700">
                    {t("pages.profile.documents.uploaded", "Documentos subidos")}
                  </span>
                </div>

                <div className="min-h-0 w-full flex justify-center">
                  <div className="w-full max-w-[220px]">
                    {/* ✅ Pendientes de guardar (seleccionados pero aún no guardados) */}
                    {pendingDocs.length > 0 && (
                      <div className="mb-2 rounded-lg border border-orange-200 bg-orange-50 p-2">
                        <p className="text-[11px] font-medium text-orange-700 mb-1">
                          {t("pages.profile.documents.pending", "Pendientes de guardar")}
                        </p>

                        <ul className="text-[11px] text-slate-700 space-y-1">
                          {pendingDocs.map((file) => (
                            <li key={file.name} className="truncate" title={file.name}>
                              📄 {file.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {formData.documents && formData.documents.length > 0 ? (
                      <ul className="text-[11px] text-slate-700 space-y-1">
                        {formData.documents.map((docUrl, index) => (
                          <li key={index} className="flex justify-center">
                            <div className="inline-flex items-center gap-1 max-w-[220px]">
                              <a
                                href={buildImageUrl(docUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-blue-600 hover:text-blue-700 underline"
                                title={displayFileNameFromUrl(docUrl)}
                              >
                                {displayFileNameFromUrl(docUrl)}
                              </a>

                              <DeleteIconButton
                                title={t("pages.profile.documents.deleteTitle")}
                                onClick={() => handleDeleteDocument(docUrl)}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-500 text-center pt-1">
                        {t("pages.profile.documents.none", "Sin documentos")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Acciones */}
          <div className="pt-1 flex items-center gap-4">
            {role === "admin" && userId && userId !== userIdFromAuthContext && (
              <DangerDeleteButton onClick={handleDeleteUser} />
            )}

            <div className="ml-auto">
              <SaveIconButton />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
