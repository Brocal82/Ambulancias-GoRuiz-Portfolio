/**
 * Phase 3.4.2 — Zod validation for PATCH /api/praemien/impact-resolutions/:id
 *
 * Allowed transitions: pending → ignored | adjusted | blocked
 * "recalculated" is intentionally excluded from this phase.
 * Note is required for all terminal transitions.
 */
import { z } from "zod";

export const PATCH_RESOLUTION_ALLOWED_STATUSES = ["ignored", "adjusted", "blocked"] as const;

export const patchImpactResolutionBodySchema = z.object({
  newStatus: z.enum(PATCH_RESOLUTION_ALLOWED_STATUSES, {
    errorMap: () => ({
      message: "newStatus must be one of: ignored, adjusted, blocked",
    }),
  }),
  note: z
    .string({ required_error: "note is required" })
    .min(1, { message: "note is required" })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "note is required" }),
});

export type PatchImpactResolutionBody = z.infer<typeof patchImpactResolutionBodySchema>;
