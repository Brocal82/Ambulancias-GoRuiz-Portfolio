import type { CreateHospitalInput, Hospital, UpdateHospitalInput } from "./types";
import { fromLocalHospitalStatus } from "../utils/status";

// Normaliza strings (trim seguro)
const normalizeString = (v?: string): string => (v ?? "").trim();

// Garantiza array de strings limpio
const normalizeStringArray = (v?: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
};

// Payload para CREATE
export const buildCreateHospitalPayload = (
  data: CreateHospitalInput,
): Partial<Hospital> => {
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
  updated: UpdateHospitalInput,
): Partial<Hospital> => {
  const statusPatch = fromLocalHospitalStatus(base, updated.isOpen);

  return {
    name: normalizeString(updated.name),
    address: normalizeString(updated.address),
    phone: normalizeString(updated.phone),
    specialties: normalizeStringArray(updated.specialties),
    ...statusPatch,
  };
};
