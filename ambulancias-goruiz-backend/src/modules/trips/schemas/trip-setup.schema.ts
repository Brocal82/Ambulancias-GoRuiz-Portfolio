import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

export const tripSetupBodySchema = z.object({
  ambulanceId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  ambulanceNumber: z.string().trim().min(1, "ambulanceNumber requerido"),
  initialKm: z.preprocess(
    (v) => {
      if (typeof v === "string" && v.trim() !== "") return Number(v);
      return v;
    },
    z.number().int().positive("initialKm debe ser mayor que 0"),
  ),
});

export const tripSetupParamsSchema = z.object({
  assignmentId: objectIdSchema,
});

