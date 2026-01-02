import React, { useEffect, useState } from "react";
import type { Ambulance } from "../../types/ambulance";
import { useTranslation } from "react-i18next";
import CancelButton from "../common/actions/CancelButton";
import SaveIconButton from "../common/actions/SaveIconButton";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ambulance: Omit<Ambulance, "_id">, id?: string) => Promise<void>;
  initialData?: Ambulance | null;
}

const MAX_LENGTH = 30;

const AmbulanceFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const { t } = useTranslation();

  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [ambulanceNumber, setAmbulanceNumber] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false); // 👈 detecta cambios en modo edit

  /* =======================
     Inicialización / Reset
     ======================= */
  useEffect(() => {
    if (initialData) {
      // Modo EDIT
      setBrand(initialData.brand);
      setModelName(initialData.modelName);
      setLicensePlate(initialData.licensePlate);
      setAmbulanceNumber(initialData.ambulanceNumber);
      setErrors({});
      setIsDirty(false);
    } else {
      // Modo CREATE
      setBrand("");
      setModelName("");
      setLicensePlate("");
      setAmbulanceNumber("");
      setErrors({});
      setIsDirty(false);
    }
  }, [initialData, isOpen]);

  /* =======================
     Validaciones
     ======================= */
  const validateField = (value: string) => {
    if (!value.trim()) {
      return t("pages.ambulances.formModal.validation.required");
    }
    if (value.length > MAX_LENGTH) {
      return t("pages.ambulances.formModal.validation.maxLength", {
        max: MAX_LENGTH,
      });
    }
    return "";
  };

  const validateAll = () => {
    const newErrors: Record<string, string> = {
      brand: validateField(brand),
      modelName: validateField(modelName),
      licensePlate: validateField(licensePlate),
      ambulanceNumber: validateField(ambulanceNumber),
    };

    setErrors(newErrors);
    return Object.values(newErrors).every((err) => err === "");
  };

  /* =======================
     Cambios de campos
     ======================= */
  const handleChange = (field: string, value: string) => {
    setIsDirty(true); // 👈 cualquier cambio marca el formulario como modificado

    switch (field) {
      case "brand":
        setBrand(value);
        setErrors((prev) => ({ ...prev, brand: validateField(value) }));
        break;
      case "modelName":
        setModelName(value);
        setErrors((prev) => ({ ...prev, modelName: validateField(value) }));
        break;
      case "licensePlate":
        setLicensePlate(value);
        setErrors((prev) => ({ ...prev, licensePlate: validateField(value) }));
        break;
      case "ambulanceNumber":
        setAmbulanceNumber(value);
        setErrors((prev) => ({
          ...prev,
          ambulanceNumber: validateField(value),
        }));
        break;
    }
  };

  /* =======================
     Submit
     ======================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    await onSave(
      { brand, modelName, licensePlate, ambulanceNumber },
      initialData?._id
    );

    onClose();
  };

  if (!isOpen) return null;

  /* =======================
     Lógica botón Guardar
     ======================= */
  const isFormInvalid =
    Object.values(errors).some((err) => err !== "") ||
    !brand.trim() ||
    !modelName.trim() ||
    !licensePlate.trim() ||
    !ambulanceNumber.trim();

  const isEditMode = Boolean(initialData);

  const isSaveDisabled =
    isFormInvalid || (isEditMode && !isDirty);

  /* =======================
     Render
     ======================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white shadow-lg ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ambulance-form-title"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200">
          <h2
            id="ambulance-form-title"
            className="text-lg font-semibold text-slate-900"
          >
            {isEditMode
              ? t("pages.ambulances.formModal.titleEdit")
              : t("pages.ambulances.formModal.titleNew")}
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand */}
            <div>
              <label
                htmlFor="ambulance-brand"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.brand")}
              </label>
              <input
                id="ambulance-brand"
                type="text"
                value={brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                title={t("pages.ambulances.formModal.fields.brand") as string}
                aria-describedby={errors.brand ? "ambulance-brand-error" : undefined}
                className={`w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.brand
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                  }`}
              />
              {errors.brand && (
                <p
                  id="ambulance-brand-error"
                  className="mt-1 text-xs text-red-600"
                >
                  {errors.brand}
                </p>
              )}
            </div>

            {/* Model */}
            <div>
              <label
                htmlFor="ambulance-model"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.model")}
              </label>
              <input
                id="ambulance-model"
                type="text"
                value={modelName}
                onChange={(e) => handleChange("modelName", e.target.value)}
                title={t("pages.ambulances.formModal.fields.model") as string}
                aria-describedby={errors.modelName ? "ambulance-model-error" : undefined}
                className={`w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.modelName
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                  }`}
              />
              {errors.modelName && (
                <p
                  id="ambulance-model-error"
                  className="mt-1 text-xs text-red-600"
                >
                  {errors.modelName}
                </p>
              )}
            </div>

            {/* License Plate */}
            <div>
              <label
                htmlFor="ambulance-plate"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.licensePlate")}
              </label>
              <input
                id="ambulance-plate"
                type="text"
                value={licensePlate}
                onChange={(e) =>
                  handleChange("licensePlate", e.target.value)
                }
                title={t("pages.ambulances.formModal.fields.licensePlate") as string}
                aria-describedby={
                  errors.licensePlate ? "ambulance-plate-error" : undefined
                }
                className={`w-full rounded-md border px-3 py-1.5 text-sm font-mono shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.licensePlate
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                  }`}
              />
              {errors.licensePlate && (
                <p
                  id="ambulance-plate-error"
                  className="mt-1 text-xs text-red-600"
                >
                  {errors.licensePlate}
                </p>
              )}
            </div>

            {/* Ambulance Number */}
            <div>
              <label
                htmlFor="ambulance-number"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.ambulanceNumber")}
              </label>
              <input
                id="ambulance-number"
                type="text"
                value={ambulanceNumber}
                onChange={(e) =>
                  handleChange("ambulanceNumber", e.target.value)
                }
                title={t("pages.ambulances.formModal.fields.ambulanceNumber") as string}
                aria-describedby={
                  errors.ambulanceNumber ? "ambulance-number-error" : undefined
                }
                className={`w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.ambulanceNumber
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                  }`}
              />
              {errors.ambulanceNumber && (
                <p
                  id="ambulance-number-error"
                  className="mt-1 text-xs text-red-600"
                >
                  {errors.ambulanceNumber}
                </p>
              )}
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-end gap-2">
          <CancelButton onClick={onClose}>
            {t("pages.ambulances.formModal.actions.cancel")}
          </CancelButton>

          <SaveIconButton
            type="submit"
            disabled={isSaveDisabled}
            title={t("pages.ambulances.formModal.actions.save")}
          />
        </div>
      </form>
    </div>
  );
};

export default AmbulanceFormModal;
