import { z } from "zod";

const hospitalSpecialtiesSchema = z
  .array(z.string())
  .transform((arr) => arr.map((s) => s.trim()).filter(Boolean));

/**
 * Schema para POST /api/hospitals
 */
export const createHospitalSchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío"),
  address: z.string().trim().min(1, "address no puede estar vacío"),
  phone: z.string().trim().min(1, "phone no puede estar vacío"),
  specialties: hospitalSpecialtiesSchema,
  isOpen: z.boolean().optional(),
});

/**
 * Schema para PATCH/PUT /api/hospitals/:id
 * Whitelist de campos actualizables. Cualquier otro campo se ignora (Zod strip).
 */
export const updateHospitalSchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío").optional(),
  address: z.string().trim().min(1, "address no puede estar vacío").optional(),
  phone: z.string().trim().min(1, "phone no puede estar vacío").optional(),
  specialties: hospitalSpecialtiesSchema.optional(),
  isOpen: z.boolean().optional(),
});

export type CreateHospitalInput = z.infer<typeof createHospitalSchema>;
export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>;
