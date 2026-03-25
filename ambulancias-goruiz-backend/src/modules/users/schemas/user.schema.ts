import { z } from "zod";

const emailSchema = z
  .string()
  .min(1, "Email requerido")
  .email("Formato de email inválido");

const ambulanceRoleSchema = z.enum(["driver", "medic", "both"]);

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/users/register — Crear usuario
 * ───────────────────────────────────────────────────────────────────────────── */
export const registerUserSchema = z.object({
  name: z.string().transform((s) => s.trim()).pipe(z.string().min(1, "Nombre requerido")),
  lastName: z.string().transform((s) => s.trim()).pipe(z.string().min(1, "Apellidos requeridos")),
  email: z.string().transform((s) => s.trim()).pipe(emailSchema),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  // role no se acepta: registro público siempre crea workers. Admins vía seed/script.
});

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/users/login — Iniciar sesión
 * ───────────────────────────────────────────────────────────────────────────── */
export const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Contraseña requerida"),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/users/me y PATCH /api/users/:id — Actualizar usuario (parcial)
 * Todos los campos opcionales; solo se validan los que vienen
 * ───────────────────────────────────────────────────────────────────────────── */
export const updateUserSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Nombre no puede estar vacío"))
    .optional(),
  lastName: z.string().transform((s) => s.trim()).optional(),
  email: z.string().transform((s) => s.trim()).pipe(emailSchema).optional(),
  ambulanceRole: ambulanceRoleSchema.optional(),
  address: z.string().transform((s) => s.trim()).optional(),
  phone: z.string().transform((s) => s.trim()).optional(),
  emergencyPhone: z.string().transform((s) => s.trim()).optional(),
  pscheinExpiry: z.string().transform((s) => s.trim()).optional(),
  profileImage: z.string().optional(),
  employeeNumber: z.string().transform((s) => s.trim()).optional(),
});
