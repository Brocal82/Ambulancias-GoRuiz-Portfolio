import React, { useEffect, useState } from "react";
import type { Ambulance } from "../../types/ambulance";
import { useTranslation } from "react-i18next";

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

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (initialData) {
      setBrand(initialData.brand);
      setModelName(initialData.modelName);
      setLicensePlate(initialData.licensePlate);
      setAmbulanceNumber(initialData.ambulanceNumber);
      setErrors({});
    } else {
      setBrand("");
      setModelName("");
      setLicensePlate("");
      setAmbulanceNumber("");
      setErrors({});
    }
  }, [initialData, isOpen]);

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
    const newErrors: { [key: string]: string } = {};
    newErrors.brand = validateField(brand);
    newErrors.modelName = validateField(modelName);
    newErrors.licensePlate = validateField(licensePlate);
    newErrors.ambulanceNumber = validateField(ambulanceNumber);
    setErrors(newErrors);
    return Object.values(newErrors).every((err) => err === "");
  };

  const handleChange = (field: string, value: string) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    await onSave(
      { brand, modelName, licensePlate, ambulanceNumber },
      initialData?._id,
    );
    onClose();
  };

  if (!isOpen) return null;

  const isSaveDisabled =
    Object.values(errors).some((err) => err !== "") ||
    !brand.trim() ||
    !modelName.trim() ||
    !licensePlate.trim() ||
    !ambulanceNumber.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-2xl shadow-lg ring-1 ring-slate-200"
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
            {initialData
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
                htmlFor="amb-brand"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.brand")}
              </label>
              <input
                id="amb-brand"
                type="text"
                value={brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                title={t("pages.ambulances.formModal.titles.brand") as string}
                aria-describedby={errors.brand ? "amb-brand-error" : undefined}
                className={`w-full rounded-md border px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                  errors.brand
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                }`}
              />
              {errors.brand && (
                <p id="amb-brand-error" className="text-red-600 text-xs mt-1">
                  {errors.brand}
                </p>
              )}
            </div>

            {/* Model */}
            <div>
              <label
                htmlFor="amb-model"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.model")}
              </label>
              <input
                id="amb-model"
                type="text"
                value={modelName}
                onChange={(e) => handleChange("modelName", e.target.value)}
                title={t("pages.ambulances.formModal.titles.model") as string}
                aria-describedby={
                  errors.modelName ? "amb-model-error" : undefined
                }
                className={`w-full rounded-md border px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                  errors.modelName
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                }`}
              />
              {errors.modelName && (
                <p id="amb-model-error" className="text-red-600 text-xs mt-1">
                  {errors.modelName}
                </p>
              )}
            </div>

            {/* License Plate */}
            <div>
              <label
                htmlFor="amb-plate"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.licensePlate")}
              </label>
              <input
                id="amb-plate"
                type="text"
                value={licensePlate}
                onChange={(e) => handleChange("licensePlate", e.target.value)}
                title={
                  t("pages.ambulances.formModal.titles.licensePlate") as string
                }
                aria-describedby={
                  errors.licensePlate ? "amb-plate-error" : undefined
                }
                className={`w-full rounded-md border px-3 py-1.5 text-sm bg-white shadow-sm font-mono tracking-tight focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                  errors.licensePlate
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                }`}
              />
              {errors.licensePlate && (
                <p id="amb-plate-error" className="text-red-600 text-xs mt-1">
                  {errors.licensePlate}
                </p>
              )}
            </div>

            {/* Ambulance Number */}
            <div>
              <label
                htmlFor="amb-number"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {t("pages.ambulances.formModal.fields.ambulanceNumber")}
              </label>
              <input
                id="amb-number"
                type="text"
                value={ambulanceNumber}
                onChange={(e) =>
                  handleChange("ambulanceNumber", e.target.value)
                }
                title={
                  t(
                    "pages.ambulances.formModal.titles.ambulanceNumber",
                  ) as string
                }
                aria-describedby={
                  errors.ambulanceNumber ? "amb-number-error" : undefined
                }
                className={`w-full rounded-md border px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                  errors.ambulanceNumber
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-400"
                }`}
              />
              {errors.ambulanceNumber && (
                <p id="amb-number-error" className="text-red-600 text-xs mt-1">
                  {errors.ambulanceNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 active:scale-95 transition"
          >
            {t("pages.ambulances.formModal.actions.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSaveDisabled}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 active:scale-95 transition ${
              isSaveDisabled
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {t("pages.ambulances.formModal.actions.save")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AmbulanceFormModal;
