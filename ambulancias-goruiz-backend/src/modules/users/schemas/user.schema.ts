import { z } from "zod";
import { parseStrictYmd } from "../utils/pschein.validation";

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
  mfaCode: z.string().trim().optional(),
});

export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código MFA debe tener 6 dígitos"),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/users/me y PATCH /api/users/:id — Actualizar usuario (parcial)
 * Todos los campos opcionales; solo se validan los que vienen.
 * `email` se elimina del body antes de validar (nunca falla ni se persiste vía PATCH).
 * ───────────────────────────────────────────────────────────────────────────── */
const updateUserFieldsSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Nombre no puede estar vacío"))
    .optional(),
  lastName: z.string().transform((s) => s.trim()).optional(),
  ambulanceRole: ambulanceRoleSchema.optional(),
  address: z.string().transform((s) => s.trim()).optional(),
  phone: z.string().transform((s) => s.trim()).optional(),
  emergencyPhone: z.string().transform((s) => s.trim()).optional(),
  pscheinExpiry: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s === "" || parseStrictYmd(s) !== null, {
      message: "La fecha de caducidad del P-Schein no es válida (use YYYY-MM-DD)",
    })
    .optional(),
  pscheinDocument: z.union([z.string(), z.null()]).optional(),
  pscheinConfirmedBy: z.union([z.string(), z.null()]).optional(),
  pscheinConfirmedAt: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.union([z.string(), z.null()]).optional(),
  ),
  profileImage: z.string().optional(),
  employeeNumber: z.string().transform((s) => s.trim()).optional(),
});

export const updateUserSchema = z.preprocess((val) => {
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    const { email: _ignored, ...rest } = val as Record<string, unknown>;
    return rest;
  }
  return val;
}, updateUserFieldsSchema);
