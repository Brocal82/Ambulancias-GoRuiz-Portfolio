// src/modules/workday/utils/closureValidators.ts

export type ClosureValidationResult =
  | { valid: true }
  | { valid: false; toastKey: string; severity: "warn" | "error" };

/**
 * Valida los datos necesarios para cierre final o parcial.
 * Función pura, sin side effects.
 * Preserva la severidad original (warn/error) de cada caso.
 */
export const validateClosureData = (args: {
  vehicleConfirmed: boolean;
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: string | number;
  finalKm: number;
  isPartial?: boolean;
  partialReason?: string;
}): ClosureValidationResult => {
  const {
    vehicleConfirmed,
    ambulanceId,
    ambulanceNumber,
    initialKm,
    finalKm,
    isPartial,
    partialReason,
  } = args;

  if (isPartial) {
    if (!(partialReason ?? "").trim()) {
      return {
        valid: false,
        toastKey: "toasts.workday.partialReasonRequired",
        severity: "warn",
      };
    }
  }

  if (isNaN(finalKm)) {
    return {
      valid: false,
      toastKey: "toasts.workday.enterFinalKmInModal",
      severity: "warn",
    };
  }

  const initialNum = Number(initialKm);
  if (finalKm < initialNum) {
    return {
      valid: false,
      toastKey: "toasts.workday.finalKmLessThanInitial",
      severity: isPartial ? "warn" : "error",
    };
  }

  if (isPartial) {
    if (!vehicleConfirmed || !ambulanceId) {
      return {
        valid: false,
        toastKey: "toasts.workday.needInitialData",
        severity: "warn",
      };
    }
    if (!ambulanceNumber) {
      return {
        valid: false,
        toastKey: "toasts.workday.enterAmbulanceAndKm",
        severity: "warn",
      };
    }
  } else {
    if (
      !vehicleConfirmed ||
      !ambulanceId ||
      !ambulanceNumber ||
      !initialKm
    ) {
      return {
        valid: false,
        toastKey: "toasts.workday.enterAmbulanceAndKm",
        severity: "warn",
      };
    }
  }

  return { valid: true };
};
