import { z } from "zod";
import { praemienRuleConfigSchema } from "../../praemien/schemas/praemien-rules.schema";

const praemienModeEffectiveFromSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
  })
  .strict();

const requiredEmailDomain = z.preprocess(
  (val) => (typeof val === "string" ? val.trim() : val),
  z
    .string()
    .min(1, "emailDomain es obligatorio")
    .toLowerCase()
    .refine((s) => s.startsWith("@"), {
      message: "emailDomain debe empezar por @",
    }),
);

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío"),
  isActive: z.boolean().optional().default(true),
  emailDomain: requiredEmailDomain,
  enabledModules: z.array(z.string()).optional(),
  praemienMode: z.enum(["automatic", "manual"]).optional(),
  praemienModeEffectiveFrom: praemienModeEffectiveFromSchema.nullable().optional(),
  praemienRules: praemienRuleConfigSchema.nullable().optional(),
});

const updateEmailDomainField = z.preprocess(
  (val) => (typeof val === "string" ? val.trim() : val),
  z
    .string()
    .min(1, "emailDomain es obligatorio")
    .toLowerCase()
    .refine((s) => s.startsWith("@"), {
      message: "emailDomain debe empezar por @",
    }),
);

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "name no puede estar vacío").optional(),
  isActive: z.boolean().optional(),
  emailDomain: updateEmailDomainField,
  enabledModules: z.array(z.string()).optional(),
  praemienMode: z.enum(["automatic", "manual"]).optional(),
  praemienModeEffectiveFrom: praemienModeEffectiveFromSchema.nullable().optional(),
  praemienRules: praemienRuleConfigSchema.nullable().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
