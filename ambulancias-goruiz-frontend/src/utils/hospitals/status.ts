import type { Hospital } from "../../types/hospital";

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
