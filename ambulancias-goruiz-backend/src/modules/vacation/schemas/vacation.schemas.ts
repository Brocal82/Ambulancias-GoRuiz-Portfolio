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

/** YYYY-MM */
const monthKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, { message: 'monthKey debe tener formato "YYYY-MM"' });

/** Estados de solicitud de vacaciones */
const vacationStatusSchema = z.enum([
  "pending",
  "accepted",
  "cancelled",
  "option_sent",
  "cancel_requested",
]);

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/vacations — Crear solicitud de vacaciones
 * ───────────────────────────────────────────────────────────────────────────── */
export const createVacationRequestSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    { message: "startDate debe ser anterior o igual a endDate", path: ["endDate"] },
  );

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/vacations/check-range — Verificar vacaciones en rango
 * ───────────────────────────────────────────────────────────────────────────── */
export const checkVacationsInRangeSchema = z
  .object({
    userIds: z
      .array(objectIdSchema)
      .min(1, "userIds debe tener al menos un elemento"),
    fromISO: dateStringSchema,
    toISO: dateStringSchema,
  })
  .refine(
    (data) => new Date(data.fromISO) <= new Date(data.toISO),
    { message: "fromISO debe ser anterior o igual a toISO", path: ["toISO"] },
  );

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/vacations/month-config — Upsert config mensual
 * ───────────────────────────────────────────────────────────────────────────── */
const blackoutRangeSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    { message: "startDate debe ser anterior o igual a endDate", path: ["endDate"] },
  );

export const upsertMonthConfigSchema = z.object({
  monthKey: monthKeySchema,
  maxPerDay: z
    .number()
    .int()
    .min(0)
    .max(31)
    .optional(),
  blackouts: z.array(blackoutRangeSchema).optional(),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/vacations/:id — Actualizar solicitud (admin)
 * ───────────────────────────────────────────────────────────────────────────── */
export const updateVacationRequestSchema = z
  .object({
    status: vacationStatusSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    adminOptionStartDate: dateStringSchema.optional(),
    adminOptionEndDate: dateStringSchema.optional(),
    adminNote: z.string().optional(),
    force: z.union([z.boolean(), z.literal("true"), z.literal("1")]).optional(),
    canForceAccept: z.union([z.boolean(), z.literal("true"), z.literal("1")]).optional(),
  })
  .refine(
    (data) => {
      const start = data.startDate;
      const end = data.endDate;
      if (!start || !end) return true;
      return new Date(start) <= new Date(end);
    },
    {
      message: "startDate debe ser anterior o igual a endDate",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      const start = data.adminOptionStartDate;
      const end = data.adminOptionEndDate;
      if (!start || !end) return true;
      return new Date(start) <= new Date(end);
    },
    {
      message: "adminOptionStartDate debe ser anterior o igual a adminOptionEndDate",
      path: ["adminOptionEndDate"],
    },
  );
