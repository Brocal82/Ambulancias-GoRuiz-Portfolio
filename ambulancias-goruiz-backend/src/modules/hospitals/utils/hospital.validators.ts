import type { HospitalCreateInput } from "../types/hospital.types";

export type { HospitalCreateInput } from "../types/hospital.types";

export const normalizeSpecialties = (specialties: unknown): string[] => {
  if (!Array.isArray(specialties)) return [];
  return specialties.map((s) => String(s).trim()).filter(Boolean);
};

export const validateCreateHospital = (
  body: HospitalCreateInput,
):
  | {
      ok: true;
      value: {
        name: string;
        address: string;
        phone: string;
        specialties: string[];
        isOpen?: boolean;
      };
    }
  | { ok: false; message: string } => {
  const { name, address, phone, specialties, isOpen } =
    (body ?? {}) as HospitalCreateInput;

  if (
    typeof name !== "string" ||
    typeof address !== "string" ||
    typeof phone !== "string" ||
    !Array.isArray(specialties)
  ) {
    return { ok: false, message: "Faltan campos obligatorios o tipo inválido" };
  }

  const cleanedSpecialties = normalizeSpecialties(specialties);

  return {
    ok: true,
    value: {
      name,
      address,
      phone,
      specialties: cleanedSpecialties,
      isOpen: typeof isOpen === "boolean" ? isOpen : undefined,
    },
  };
};

export const normalizeUpdateHospital = (body: unknown): Record<string, unknown> => {
  const updatedFields: Record<string, unknown> =
    body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};

  // Limpiar especialidades si vienen
  if (Array.isArray(updatedFields.specialties)) {
    updatedFields.specialties = (updatedFields.specialties as unknown[]).map((s) =>
      String(s).trim(),
    );
  }

  return updatedFields;
};
