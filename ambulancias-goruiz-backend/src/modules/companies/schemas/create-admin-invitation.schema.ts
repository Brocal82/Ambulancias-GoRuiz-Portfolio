import { z } from "zod";

export const createCompanyAdminInvitationSchema = z.object({
  email: z
    .string()
    .min(1, "Email requerido")
    .email("Formato de email inválido")
    .transform((s) => s.trim().toLowerCase()),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});
