import { z } from "zod";

/**
 * Schema para PATCH/PUT /api/hospitals/:id
 * Whitelist de campos actualizables. Cualquier otro campo se ignora (Zod strip).
 */
export const updateHospitalSchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío").optional(),
  address: z.string().trim().min(1, "address no puede estar vacío").optional(),
  phone: z.string().trim().min(1, "phone no puede estar vacío").optional(),
  specialties: z
    .array(z.string().trim().min(1))
    .transform((arr) => arr.filter(Boolean))
    .optional(),
  isOpen: z.boolean().optional(),
});

export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>;
