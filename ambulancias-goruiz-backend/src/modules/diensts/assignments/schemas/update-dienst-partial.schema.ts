import { z } from "zod";

/** ObjectId MongoDB: 24 hex chars */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

/** ObjectId válido, o ""/null para limpiar (unset) */
const objectIdOrEmptySchema = z.union([
  objectIdSchema,
  z.literal(""),
  z.null(),
]);

/** Fecha válida YYYY-MM-DD o parseable */
const dateStringSchema = z.string().refine(
  (val) => val.length > 0 && !isNaN(Date.parse(val)),
  { message: "Fecha inválida" },
);

/**
 * Shape de cada assignment en PATCH /api/diensts/:id (updateDienstPartial).
 * Compatible con: merge por date, driver/medic/ambulanceId opcionales o vacíos para unset.
 */
const assignmentItemSchema = z.object({
  date: dateStringSchema,
  startTime: z.string().min(1, "startTime requerido"),
  endTime: z.string().min(1, "endTime requerido"),
  _id: z.union([objectIdSchema, z.literal("")]).optional(),
  driver: objectIdOrEmptySchema.optional(),
  medic: objectIdOrEmptySchema.optional(),
  ambulanceId: objectIdOrEmptySchema.optional(),
});

/**
 * Body de PATCH /api/diensts/:id
 */
export const updateDienstPartialSchema = z.object({
  assignments: z
    .array(assignmentItemSchema)
    .min(1, "assignments debe tener al menos un elemento"),
});
