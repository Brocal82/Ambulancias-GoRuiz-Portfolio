/**
 * Phase 2.3 — Absence Cleanup Monitor: HTTP validation schemas.
 */
import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato YYYY-MM-DD");

/** POST /api/operational-recovery/absence-cleanup/repair body schema. */
export const repairAbsenceCleanupSchema = z.object({
  items: z
    .array(
      z.object({
        workerId: objectIdSchema,
        absenceType: z.enum(["vacation", "sick"]),
        absenceId: objectIdSchema,
      }),
    )
    .min(1, "Se requiere al menos un elemento")
    .max(50, "Máximo 50 elementos por petición"),
});

/** GET /api/operational-recovery/absence-cleanup query schema. */
export const scanAbsenceCleanupQuerySchema = z.object({
  fromDate: isoDateSchema.optional(),
  toDate: isoDateSchema.optional(),
});
