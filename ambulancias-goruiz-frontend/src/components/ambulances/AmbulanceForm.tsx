import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Ambulance } from "../../types/ambulance";

export const MAX_LENGTH = 30;

export type AmbulanceFormValues = Omit<Ambulance, "_id">;

type AmbulanceFormErrors = Partial<Record<keyof AmbulanceFormValues, string>>;

function normalize(values: AmbulanceFormValues) {
    return {
        brand: values.brand.trim(),
        modelName: values.modelName.trim(),
        licensePlate: values.licensePlate.trim(),
        ambulanceNumber: values.ambulanceNumber.trim(),
    };
}

export function useAmbulanceForm(initialData?: Ambulance | null, isOpen?: boolean) {
    const { t } = useTranslation();

    const [values, setValues] = useState<AmbulanceFormValues>({
        brand: "",
        modelName: "",
        licensePlate: "",
        ambulanceNumber: "",
    });

    const [errors, setErrors] = useState<AmbulanceFormErrors>({});
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setValues({
                brand: initialData.brand ?? "",
                modelName: initialData.modelName ?? "",
                licensePlate: initialData.licensePlate ?? "",
                ambulanceNumber: initialData.ambulanceNumber ?? "",
            });
            setErrors({});
            setIsDirty(false);
        } else {
            setValues({
                brand: "",
                modelName: "",
                licensePlate: "",
                ambulanceNumber: "",
            });
            setErrors({});
            setIsDirty(false);
        }
    }, [initialData, isOpen]);

    const validateField = (value: string) => {
        if (!value.trim()) return t("pages.ambulances.formModal.validation.required");
        if (value.length > MAX_LENGTH) {
            return t("pages.ambulances.formModal.validation.maxLength", { max: MAX_LENGTH });
        }
        return "";
    };

    const setField = (field: keyof AmbulanceFormValues, value: string) => {
        setIsDirty(true);
        setValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: validateField(value) }));
    };

    const validateAll = () => {
        const nextErrors: AmbulanceFormErrors = {
            brand: validateField(values.brand),
            modelName: validateField(values.modelName),
            licensePlate: validateField(values.licensePlate),
            ambulanceNumber: validateField(values.ambulanceNumber),
        };
        setErrors(nextErrors);
        return Object.values(nextErrors).every((e) => !e);
    };

    const isFormInvalid = useMemo(() => {
        const hasErrors = Object.values(errors).some((e) => Boolean(e));
        const v = normalize(values);
        const missing =
            !v.brand || !v.modelName || !v.licensePlate || !v.ambulanceNumber;
        return hasErrors || missing;
    }, [errors, values]);

    return {
        t,
        values,
        errors,
        isDirty,
        isFormInvalid,
        setField,
        validateAll,
        normalizeValues: () => normalize(values),
        resetDirty: () => setIsDirty(false),
    };
}

interface AmbulanceFormProps {
    values: AmbulanceFormValues;
    errors: Partial<Record<keyof AmbulanceFormValues, string>>;
    onChange: (field: keyof AmbulanceFormValues, value: string) => void;
}

const AmbulanceForm: React.FC<AmbulanceFormProps> = ({ values, errors, onChange }) => {
    const { t } = useTranslation();

    return (
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
                        value={values.brand}
                        onChange={(e) => onChange("brand", e.target.value)}
                        title={t("pages.ambulances.formModal.fields.brand") as string}
                        aria-describedby={errors.brand ? "ambulance-brand-error" : undefined}
                        className={`w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.brand ? "border-red-500" : "border-slate-300 focus:border-blue-400"
                            }`}
                    />
                    {errors.brand && (
                        <p id="ambulance-brand-error" className="mt-1 text-xs text-red-600">
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
                        value={values.modelName}
                        onChange={(e) => onChange("modelName", e.target.value)}
                        title={t("pages.ambulances.formModal.fields.model") as string}
                        aria-describedby={errors.modelName ? "ambulance-model-error" : undefined}
                        className={`w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.modelName ? "border-red-500" : "border-slate-300 focus:border-blue-400"
                            }`}
                    />
                    {errors.modelName && (
                        <p id="ambulance-model-error" className="mt-1 text-xs text-red-600">
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
                        value={values.licensePlate}
                        onChange={(e) => onChange("licensePlate", e.target.value)}
                        title={t("pages.ambulances.formModal.fields.licensePlate") as string}
                        aria-describedby={errors.licensePlate ? "ambulance-plate-error" : undefined}
                        className={`w-full rounded-md border px-3 py-1.5 text-sm font-mono shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.licensePlate
                                ? "border-red-500"
                                : "border-slate-300 focus:border-blue-400"
                            }`}
                    />
                    {errors.licensePlate && (
                        <p id="ambulance-plate-error" className="mt-1 text-xs text-red-600">
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
                        value={values.ambulanceNumber}
                        onChange={(e) => onChange("ambulanceNumber", e.target.value)}
                        title={t("pages.ambulances.formModal.fields.ambulanceNumber") as string}
                        aria-describedby={errors.ambulanceNumber ? "ambulance-number-error" : undefined}
                        className={`w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.ambulanceNumber
                                ? "border-red-500"
                                : "border-slate-300 focus:border-blue-400"
                            }`}
                    />
                    {errors.ambulanceNumber && (
                        <p id="ambulance-number-error" className="mt-1 text-xs text-red-600">
                            {errors.ambulanceNumber}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AmbulanceForm;
