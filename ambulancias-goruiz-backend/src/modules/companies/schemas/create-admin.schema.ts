import { z } from "zod";

export const createCompanyAdminSchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío"),
  lastName: z.string().trim().min(1, "lastName no puede estar vacío"),
  email: z.string().trim().min(1, "email requerido").email("email inválido"),
  password: z.string().min(8, "password debe tener al menos 8 caracteres"),
});

export type CreateCompanyAdminInput = z.infer<typeof createCompanyAdminSchema>;
