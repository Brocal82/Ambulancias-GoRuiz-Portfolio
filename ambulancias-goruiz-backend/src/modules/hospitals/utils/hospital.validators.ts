import {
  createHospitalSchema,
  type CreateHospitalInput,
} from "../schemas/hospital.schema";

export type { CreateHospitalInput, UpdateHospitalInput } from "../schemas/hospital.schema";

export const normalizeSpecialties = (specialties: unknown): string[] => {
  if (!Array.isArray(specialties)) return [];
  return specialties.map((s) => String(s).trim()).filter(Boolean);
};

export const validateCreateHospital = (
  body: unknown,
):
  | { ok: true; value: CreateHospitalInput }
  | { ok: false; message: string } => {
  const parsed = createHospitalSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const message =
      first?.path?.length
        ? `${first.path.join(".")}: ${first.message}`
        : first?.message ?? "Datos inválidos";
    return { ok: false, message };
  }
  return { ok: true, value: parsed.data };
};
