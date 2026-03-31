// frontend/src/pages/Profile.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toastT } from "../../../utils/toast";
import { useAuth } from "../../../hooks/useAuth";
import * as UsersApi from "../domain/api";

import { getPscheinInfo } from "../../../utils/pscheinUtils";
import type { User, AmbulanceRole } from "../domain/types";

import { useTranslation } from "react-i18next";
import { buildImageUrl } from "../../../utils/apiOrigins";
import { openSecureFile } from "../../../utils/openSecureFile";
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
  const isWorkerSelfProfile = role === "worker" && !userId;
  const showWorkerEmployeeReadOnly =
    isWorkerSelfProfile && Boolean(formData.employeeNumber?.trim());
  const showEmployeeNumberColumn =
    isAdminEditingOtherUser || showWorkerEmployeeReadOnly;

  /** Last server-backed P-Schein pair; only used for admin editing another user */
  const pscheinSnapshotRef = useRef<{ expiry: string; docPath: string }>({
    expiry: "",
    docPath: "",
  });

  useEffect(() => {
    setLoading(true);

    const fetchData = async () => {
      if (!token) return;

      const idToFetch = userId || userIdFromAuthContext;
      if (!idToFetch) return;

      try {
        const fetchedUser = await UsersApi.getUserById(idToFetch);
        setFormData(fetchedUser);
        pscheinSnapshotRef.current = {
          expiry: (fetchedUser.pscheinExpiry ?? "").trim(),
          docPath: (fetchedUser.pscheinDocument ?? "").trim(),
        };
      } catch (error) {
        console.error(error);
        toastT.error(["pages.profile.messages.loadError"]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, userIdFromAuthContext, token]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const idToUpdate = userId || userIdFromAuthContext;
    if (!idToUpdate || !token) return;

    try {
      let uploadedProfileImage: string | undefined;
      let formAfterUpload = formData;

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
        const docFromUpload =
          typeof uploadData?.pscheinDocument === "string"
            ? uploadData.pscheinDocument
            : undefined;
        if (docFromUpload) {
          formAfterUpload = { ...formData, pscheinDocument: docFromUpload };
        }
      }

      const payload: UpdateUserPayload = {
        name: formData.name || "",
        lastName: formData.lastName || "",
        address: formData.address,
        phone: formData.phone,
        emergencyPhone: formData.emergencyPhone,
        profileImage: uploadedProfileImage || formData.profileImage,
        ...(!isWorkerSelfProfile
          ? {
              ambulanceRole: formData.ambulanceRole,
              pscheinExpiry: formData.pscheinExpiry,
            }
          : {}),
        ...(isAdminEditingOtherUser
          ? { employeeNumber: (formData.employeeNumber ?? "").trim() }
          : {}),
      };

      if (isAdminEditingOtherUser && userIdFromAuthContext) {
        const exp = (formData.pscheinExpiry ?? "").trim();
        const docPath = (formAfterUpload.pscheinDocument ?? "").trim();
        const snap = pscheinSnapshotRef.current;

        if (!exp || !docPath) {
          payload.pscheinDocument = null;
          payload.pscheinConfirmedAt = null;
          payload.pscheinConfirmedBy = null;
        } else if (exp !== snap.expiry || docPath !== snap.docPath) {
          payload.pscheinDocument = docPath;
          payload.pscheinConfirmedAt = new Date().toISOString();
          payload.pscheinConfirmedBy = userIdFromAuthContext;
        }
      }

      // ✅ Validación mínima (evita mandar strings vacíos); email not sent on PATCH
      if (!payload.name || !payload.lastName || !formData.email) {
        toastT.error(["pages.profile.messages.missingRequired"]);
        return;
      }

      await UsersApi.updateUserProfile(idToUpdate, payload);


      // Refrescamos datos
      const updatedUser = await UsersApi.getUserById(idToUpdate);

      setFormData(updatedUser);
      pscheinSnapshotRef.current = {
        expiry: (updatedUser.pscheinExpiry ?? "").trim(),
        docPath: (updatedUser.pscheinDocument ?? "").trim(),
      };

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
      setFormData((prev) => {
        const next: Partial<User> = {
          ...prev,
          pscheinDocument: result.pscheinDocument,
          pscheinConfirmedAt: undefined,
          pscheinConfirmedBy: undefined,
        };
        if (isAdminEditingOtherUser) {
          pscheinSnapshotRef.current = {
            expiry: (next.pscheinExpiry ?? "").trim(),
            docPath: (next.pscheinDocument ?? "").trim(),
          };
        }
        return next;
      });
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.profile.docDeleteError"]);
    }
  };

  // Eliminar imagen de perfil
  const handleDeleteProfileImage = async () => {
    const idToUpdate = userId || userIdFromAuthContext;
    if (
      !token ||
      !idToUpdate ||
      !formData.name ||
      !formData.lastName ||
      !formData.email
    ) {
      toastT.error("toasts.profile.missingRequired");
      return;
    }

    try {
      const updatedUser = await UsersApi.updateUserProfile(idToUpdate, {
        name: formData.name,
        lastName: formData.lastName,
        email: formData.email,
        address: formData.address,
        phone: formData.phone,
        emergencyPhone: formData.emergencyPhone,
        profileImage: "",
        ...(!isWorkerSelfProfile
          ? {
              ambulanceRole: formData.ambulanceRole,
              pscheinExpiry: formData.pscheinExpiry,
            }
          : {}),
      });

      setFormData(updatedUser);
      if (idToUpdate === userIdFromAuthContext) {
        login(token, idToUpdate, role || "worker", updatedUser);
      }

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

  const hasAssignedAmbulanceRole =
    formData.ambulanceRole === "medic" ||
    formData.ambulanceRole === "driver" ||
    formData.ambulanceRole === "both";

  const hidePscheinColumnWorkerSelf =
    isWorkerSelfProfile && !showPschein;

  // 📌 Documentos seleccionados (pendientes de guardar)
  // documentsFiles es FileList | null, lo convertimos a array para poder mapearlo en el render
  const pendingDocs = documentsFiles ? Array.from(documentsFiles) : [];

  const displayedPscheinDocUrl = (formData.pscheinDocument ?? "").trim() || null;

  const pscheinBlockGridClass = hidePscheinColumnWorkerSelf
    ? "lg:grid-cols-2"
    : displayedPscheinDocUrl
      ? "lg:grid-cols-3"
      : "lg:grid-cols-2";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
      <div className="rounded-2xl bg-white shadow ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="relative px-5 py-4 bg-slate-900 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
            {`${formData.lastName ?? ""}, ${formData.name ?? ""}`.trim() || "—"}
          </h2>
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
                {isWorkerSelfProfile ? (
                  hasAssignedAmbulanceRole ? (
                    <>
                      <p className="text-[11px] font-medium text-slate-700 text-center mb-1">
                        {t("pages.profile.labels.ambulanceRole")}
                      </p>
                      <div className="flex items-center justify-center gap-1 text-2xl leading-none">
                        {formData.ambulanceRole === "driver" ? (
                          <span>{t("pages.profile.roles.driver")}</span>
                        ) : formData.ambulanceRole === "medic" ? (
                          <span>{t("pages.profile.roles.medic")}</span>
                        ) : (
                          <>
                            <span>{t("pages.profile.roles.medic")}</span>
                            <span>{t("pages.profile.roles.driver")}</span>
                          </>
                        )}
                      </div>
                    </>
                  ) : null
                ) : (
                  <>
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
                              setFormData({
                                ...formData,
                                ambulanceRole: currentRole,
                              })
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
                  </>
                )}
              </div>
            </div>

            {/* ✅ Inputs en 2 columnas (sin duplicar nombre en grande) */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Primera fila: Nombre + Apellidos (+ Número solo admin / otro usuario) */}
                <div
                  className={`grid grid-cols-1 gap-3 md:col-span-2 ${showEmployeeNumberColumn ? "md:grid-cols-3" : "md:grid-cols-2"}`}
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
                        {t("pages.profile.employeeNumber")}
                      </label>
                      <input
                        type="text"
                        id="employeeNumber"
                        name="employeeNumber"
                        value={formData.employeeNumber ?? ""}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                        placeholder={t(
                          "pages.profile.employeeNumberPlaceholder",
                        )}
                        title={t("pages.profile.employeeNumberHint")}
                      />
                    </div>
                  )}
                  {showWorkerEmployeeReadOnly && (
                    <div className="space-y-1">
                      <span className="block text-xs font-medium text-slate-700">
                        {t("pages.profile.employeeNumber")}
                      </span>
                      <p
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800"
                        title={t("pages.profile.employeeNumberHint")}
                      >
                        {formData.employeeNumber}
                      </p>
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

          {/* Certificado P-Schein (PDF): subida + caducidad + archivo actual (sin catálogo general) */}
          <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-3">
            <div
              className={`grid grid-cols-1 gap-3 items-stretch ${pscheinBlockGridClass}`}
            >
              {/* Columna 1 — subir PDF del P-Schein */}
              <div
                className={`h-full place-items-center text-center ${isWorkerSelfProfile ? "flex flex-col items-center justify-center gap-0" : "grid grid-rows-[auto_1fr] gap-2"}`}
              >
                {!isWorkerSelfProfile && (
                  <div className="min-h-5 flex flex-col items-center justify-center gap-0.5 px-1">
                    <span className="text-[11px] font-semibold text-slate-800">
                      {t(
                        "pages.profile.pschein.certificateUploadTitle",
                        "Certificado P-Schein (PDF)",
                      )}
                    </span>
                    <span className="text-[10px] font-normal text-slate-500 leading-snug">
                      {t(
                        "pages.profile.pschein.certificateUploadSubtitle",
                        "Sube el PDF del certificado",
                      )}
                    </span>
                  </div>
                )}

                <div className="min-h-0 w-full flex justify-center">
                  <div className="w-full max-w-[220px]">
                    <FileUpload
                      id="profile-docs"
                      label={
                        isWorkerSelfProfile
                          ? "Upload pschein"
                          : t(
                              "pages.profile.pschein.uploadLabel",
                              "Seleccionar PDF",
                            )
                      }
                      hintWhenEmpty={t(
                        "pages.profile.pschein.uploadHint",
                        "Un archivo PDF (máx. 10 MB)",
                      )}
                      accept="application/pdf"
                      multiple={false}
                      maxSizeMB={10}
                      onChange={(files) => setDocumentsFiles(files)}
                      onError={(msg) => toastT.warn(msg)}
                      showSelectedList={false}
                      className="flex flex-col items-center text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Columna 2 — caducidad; solo si aplica rol P-Schein y ya hay PDF guardado en perfil */}
              {!hidePscheinColumnWorkerSelf && displayedPscheinDocUrl && (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                <div className="min-h-0 w-full flex justify-center">
                  <div className="w-full max-w-[220px] flex flex-col items-center gap-2">
                    {showPschein ? (
                      <div className="w-full flex flex-col items-center">
                        <label htmlFor="pscheinExpiry" className="sr-only">
                          {t("pages.profile.labels.pscheinExpiry")}
                        </label>

                        {isWorkerSelfProfile ? (
                          <p
                            className={`w-full rounded-lg px-2 py-1 text-xs text-center border bg-slate-50 ${getPscheinInfo(formData.pscheinExpiry).status === "expired"
                              ? "border-red-500 text-red-800"
                              : getPscheinInfo(formData.pscheinExpiry).status ===
                                  "warning"
                                ? "border-orange-400 text-orange-900"
                                : "border-slate-300 text-slate-800"
                              }`}
                          >
                            {formData.pscheinExpiry?.trim()
                              ? formData.pscheinExpiry
                              : t(
                                  "pages.profile.pschein.pendingAdminRegistration",
                                  "Fecha de caducidad pendiente",
                                )}
                          </p>
                        ) : (
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
                        )}

                        {pschein.status === "expired" && (
                          <p className="text-red-600 text-[11px] mt-1 text-center">
                            {t(
                              "pages.profile.pschein.expiredDynamic",
                              "Caducado hace {{months}} meses",
                              { months: Math.abs(pschein.monthsLeft ?? 0) },
                            )}
                          </p>
                        )}
                        {pschein.status === "warning" && (
                          <p className="text-orange-600 text-[11px] mt-1 text-center">
                            {t(
                              "pages.profile.pschein.warningDynamic",
                              "Caduca en {{months}} meses ({{days}} días)",
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
                              "Válido ({{months}} meses restantes)",
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
              </div>
              )}

              {/* Columna 3 — documento P-Schein (solo acciones) */}
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                <div className="min-h-0 w-full flex justify-center">
                  <div className="w-full max-w-[220px]">
                    {pendingDocs.length > 0 && (
                      <div className="mb-2 rounded-lg border border-orange-200 bg-orange-50 p-2">
                        <span className="mb-1 block text-[11px] font-medium text-orange-700">
                          {t("pages.profile.documents.pending", "Pendientes de guardar")}
                        </span>

                        <ul className="text-[11px] text-slate-700 space-y-1">
                          {pendingDocs.map((file) => (
                            <li key={file.name} className="truncate" title={file.name}>
                              📄 {file.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {displayedPscheinDocUrl ? (
                      <div className="flex justify-center">
                        <div className="inline-flex items-center gap-2 max-w-[220px]">
                          <button
                            type="button"
                            onClick={() =>
                              openSecureFile(displayedPscheinDocUrl)
                            }
                            className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
                            title={displayFileNameFromUrl(
                              displayedPscheinDocUrl,
                            )}
                          >
                            P-schein
                          </button>

                          <DeleteIconButton
                            title={t("pages.profile.documents.deleteTitle")}
                            onClick={() =>
                              handleDeleteDocument(displayedPscheinDocUrl)
                            }
                          />
                        </div>
                      </div>
                    ) : null}
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
