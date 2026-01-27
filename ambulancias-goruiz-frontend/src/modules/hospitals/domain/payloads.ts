import type { Hospital } from "./types";
import { fromLocalHospitalStatus } from "../../../utils/hospitals/status";


// Normaliza strings (trim seguro)
const normalizeString = (v?: string): string => (v ?? "").trim();

// Garantiza array de strings limpio
const normalizeStringArray = (v?: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
};

// Payload para CREATE
export const buildCreateHospitalPayload = (data: {
  name: string;
  address: string;
  phone: string;
  specialties: string[];
}): Partial<Hospital> => {
  return {
    name: normalizeString(data.name),
    address: normalizeString(data.address),
    phone: normalizeString(data.phone),
    specialties: normalizeStringArray(data.specialties),
    isOpen: true,
  };
};

// Payload para UPDATE
export const buildUpdateHospitalPayload = (
  base: Hospital,
  updated: Hospital,
): Partial<Hospital> => {
  const statusPatch = fromLocalHospitalStatus(base, (updated as any).isOpen);

  return {
    name: normalizeString(updated.name),
    address: normalizeString(updated.address),
    phone: normalizeString(updated.phone),
    specialties: normalizeStringArray(updated.specialties),
    ...statusPatch,
  };
};
