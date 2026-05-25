import { z } from "zod";
import { MAX_ODOMETER_KM } from "../utils/kmValidation";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

const closureKmSchema = z.coerce
  .number()
  .finite({ message: "Kilómetros inválidos" })
  .min(0, { message: "Los kilómetros no pueden ser negativos" })
  .max(MAX_ODOMETER_KM, { message: "Los kilómetros están fuera del rango permitido" });

/** Client may send trip refs; only `_id` is used server-side. */
const closureTripRefSchema = z
  .object({
    _id: objectIdSchema.optional(),
  })
  .passthrough();

const closureKmRefine = (
  data: { initialKm: number; finalKm: number },
  ctx: z.RefinementCtx,
): void => {
  if (data.finalKm < data.initialKm) {
    ctx.addIssue({
      code: "custom",
      path: ["finalKm"],
      message: "El km final no puede ser menor que el inicial",
    });
  }
};

const baseClosureBodySchema = z.object({
  date: z
    .string()
    .min(1, { message: "Fecha requerida" })
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      message: "Fecha inválida",
    }),
  assignmentId: objectIdSchema,
  ambulanceId: objectIdSchema,
  ambulanceNumber: z.string().min(1, { message: "Número de ambulancia requerido" }),
  initialKm: closureKmSchema,
  finalKm: closureKmSchema,
  trips: z.array(closureTripRefSchema).default([]),
});

export const finalClosureBodySchema = baseClosureBodySchema
  .extend({
    extraNote: z.string().optional(),
    checklistItems: z.record(z.boolean()).optional(),
    o2Level: z.number().finite().optional(),
  })
  .superRefine(closureKmRefine);

export const partialClosureBodySchema = baseClosureBodySchema
  .extend({
    partialClosureReason: z
      .string()
      .min(1, { message: "Motivo de cierre parcial requerido" })
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, {
        message: "Motivo de cierre parcial requerido",
      }),
  })
  .superRefine(closureKmRefine);

export const reviewSummaryParamsSchema = z.object({
  id: objectIdSchema,
});

export type FinalClosureBody = z.infer<typeof finalClosureBodySchema>;
export type PartialClosureBody = z.infer<typeof partialClosureBodySchema>;
