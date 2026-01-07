// src/utils/ambulances/ambulanceFormUtils.ts

export const MAX_AMBULANCE_FIELD_LENGTH = 30;

type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Normaliza los valores del form (MISMO comportamiento que antes).
 */
export function normalizeAmbulanceFormValues<T extends {
  brand: string;
  modelName: string;
  licensePlate: string;
  ambulanceNumber: string;
}>(values: T) {
  return {
    brand: values.brand.trim(),
    modelName: values.modelName.trim(),
    licensePlate: values.licensePlate.trim(),
    ambulanceNumber: values.ambulanceNumber.trim(),
  };
}

/**
 * Valida un campo individual (MISMA lógica que antes).
 */
export function validateAmbulanceField(value: string, t: TFn) {
  if (!value.trim()) return t("pages.ambulances.formModal.validation.required");
  if (value.length > MAX_AMBULANCE_FIELD_LENGTH) {
    return t("pages.ambulances.formModal.validation.maxLength", {
      max: MAX_AMBULANCE_FIELD_LENGTH,
    });
  }
  return "";
}

/**
 * Valida todos los campos del form y devuelve un objeto de errores.
 */
export function validateAmbulanceFormValues<T extends {
  brand: string;
  modelName: string;
  licensePlate: string;
  ambulanceNumber: string;
}>(values: T, t: TFn) {
  return {
    brand: validateAmbulanceField(values.brand, t),
    modelName: validateAmbulanceField(values.modelName, t),
    licensePlate: validateAmbulanceField(values.licensePlate, t),
    ambulanceNumber: validateAmbulanceField(values.ambulanceNumber, t),
  };
}

/**
 * Comprueba si faltan campos obligatorios (basado en valores normalizados).
 */
export function hasMissingAmbulanceFields<T extends {
  brand: string;
  modelName: string;
  licensePlate: string;
  ambulanceNumber: string;
}>(values: T) {
  const v = normalizeAmbulanceFormValues(values);
  return !v.brand || !v.modelName || !v.licensePlate || !v.ambulanceNumber;
}
