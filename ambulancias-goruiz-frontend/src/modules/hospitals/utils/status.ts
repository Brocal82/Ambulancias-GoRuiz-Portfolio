import type { Hospital } from "../domain/types";

// Devuelve boolean si puede inferirlo, o undefined si no hay dato
export const getHospitalIsOpen = (hospital: Hospital): boolean | undefined => {
  const anyHospital = hospital as any;

  if (typeof anyHospital?.isOpen === "boolean") return anyHospital.isOpen;

  if (typeof anyHospital?.status === "string") {
    const v = String(anyHospital.status).toLowerCase();
    if (v === "open") return true;
    if (v === "closed") return false;
  }

  return undefined;
};

// --- EDIT MODAL helpers ---

export type HospitalStatusUnion = "open" | "closed";

// Convierte hospital → boolean local (para radio buttons)
export const toLocalHospitalStatus = (
  hospital: Hospital,
): boolean | undefined => {
  return getHospitalIsOpen(hospital);
};

// Convierte boolean local → payload compatible (isOpen o status)
export const fromLocalHospitalStatus = (
  base: Hospital,
  isOpenBool: boolean | undefined,
): { isOpen?: boolean; status?: HospitalStatusUnion } => {
  const anyHospital = base as any;

  if (typeof anyHospital?.isOpen === "boolean") {
    return typeof isOpenBool === "boolean" ? { isOpen: isOpenBool } : {};
  }

  if (typeof anyHospital?.status === "string") {
    return typeof isOpenBool === "boolean"
      ? { status: isOpenBool ? "open" : "closed" }
      : {};
  }

  return typeof isOpenBool === "boolean" ? { isOpen: isOpenBool } : {};
};

