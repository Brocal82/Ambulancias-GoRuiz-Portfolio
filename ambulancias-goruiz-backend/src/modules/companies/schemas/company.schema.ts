import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío"),
  isActive: z.boolean().optional().default(true),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío").optional(),
  isActive: z.boolean().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
