import { z } from "zod";

/** ObjectId MongoDB: 24 hex chars */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

/** Fecha válida (string ISO o parseable) */
const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Fecha inválida" },
);

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/workday-summary/report-issue — Reportar avería
 * Shape según service y WorkdayIssue model
 * ───────────────────────────────────────────────────────────────────────────── */
export const reportIssueSchema = z.object({
  dienstNumber: z.number().int().positive(),
  date: dateStringSchema,
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  team: z.string().optional(),
  ambulanceNumber: z.string().min(1, "ambulanceNumber requerido"),
  ambulanceId: objectIdSchema,
  finalKm: z.number().optional(),
  timestamp: z.string().min(1, "timestamp requerido"),
  issueText: z.string().min(1, "issueText requerido"),
  driver: objectIdSchema.optional(),
  medic: objectIdSchema.optional(),
});
