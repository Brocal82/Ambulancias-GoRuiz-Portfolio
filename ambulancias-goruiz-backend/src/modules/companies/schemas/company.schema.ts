import { z } from "zod";

const optionalEmailDomain = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => s.startsWith("@"), {
      message: "emailDomain debe empezar por @",
    })
    .optional(),
);

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío"),
  isActive: z.boolean().optional().default(true),
  emailDomain: optionalEmailDomain,
  enabledModules: z.array(z.string()).optional(),
});

/** PATCH: omit = sin cambio; null = borrar dominio guardado */
const updateEmailDomainField = z.preprocess(
  (val) => {
    if (val === null) return null;
    if (val === "" || val === undefined) return undefined;
    return val;
  },
  z
    .union([
      z.null(),
      z
        .string()
        .trim()
        .toLowerCase()
        .refine((s) => s.startsWith("@"), {
          message: "emailDomain debe empezar por @",
        }),
    ])
    .optional(),
);

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío").optional(),
  isActive: z.boolean().optional(),
  emailDomain: updateEmailDomainField,
  enabledModules: z.array(z.string()).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
