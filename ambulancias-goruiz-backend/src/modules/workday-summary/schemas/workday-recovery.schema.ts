/**
 * Phase 3.2 — Zod validation schemas for Workday Recovery HTTP endpoints.
 *
 * POST /api/workday-summary/:id/corrections
 */
import { z } from "zod";

/**
 * Impact values allowed in Phase 3.2.
 * "recalculated" and "blocked" are rejected here — those require Phase 3.4 integration.
 */
const ALLOWED_PHASE_3_2_IMPACT = ["none", "possible"] as const;

const optionalCorrectedField = z
  .number({
    invalid_type_error: "Value must be a number",
  })
  .finite({ message: "Value must be a finite number" })
  .min(0, { message: "Value cannot be negative" })
  .optional();

export const createCorrectionBodySchema = z
  .object({
    correctedFinalKm: optionalCorrectedField,
    correctedTotalDienstKm: optionalCorrectedField,
    correctedTotalEffectivePatients: optionalCorrectedField,
    correctedTotalRealTrips: optionalCorrectedField,

    correctionReason: z
      .string({ required_error: "correctionReason is required" })
      .min(1, { message: "correctionReason is required" })
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: "correctionReason is required" }),

    correctionNote: z
      .string()
      .optional()
      .transform((s) => (s?.trim() || undefined)),

    praemienImpact: z.enum(ALLOWED_PHASE_3_2_IMPACT, {
      errorMap: () => ({
        message: "praemienImpact must be 'none' or 'possible'",
      }),
    }),
    payrollImpact: z.enum(ALLOWED_PHASE_3_2_IMPACT, {
      errorMap: () => ({
        message: "payrollImpact must be 'none' or 'possible'",
      }),
    }),
  })
  .refine(
    (data) =>
      data.correctedFinalKm !== undefined ||
      data.correctedTotalDienstKm !== undefined ||
      data.correctedTotalEffectivePatients !== undefined ||
      data.correctedTotalRealTrips !== undefined,
    {
      message: "At least one corrected field is required",
      path: ["correctedFinalKm"],
    },
  );

export type CreateCorrectionBody = z.infer<typeof createCorrectionBodySchema>;
