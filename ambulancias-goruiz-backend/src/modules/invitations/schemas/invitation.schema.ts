import { z } from "zod";

const emailSchema = z
  .string()
  .min(1, "Email requerido")
  .email("Formato de email inválido")
  .transform((s) => s.trim().toLowerCase());

const optionalEmployeeNumber = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.string().trim().max(64).optional(),
);

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "worker"]),
  expiresInDays: z.number().int().min(1).max(90).optional(),
  employeeNumber: optionalEmployeeNumber,
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Nombre requerido")),
  lastName: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Apellidos requeridos")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
