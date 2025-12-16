// backend/src/schemas/tripSchema.ts
import { z } from "zod";

// Validación de ObjectId
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

export const tripSchema = z
  .object({
    // IDs y base
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Fecha inválida",
    }),
    assignmentId: objectIdSchema,
    driver: objectIdSchema,
    medic: objectIdSchema,

    // Datos del paciente
    auftragNumber: z.string().min(1, "Número de Auftrag requerido"),
    patientName: z.string().min(1, "Nombre del paciente requerido"),
    fromAddress: z.string().min(1, "Dirección de origen requerida"),
    toAddress: z.string().min(1, "Dirección de destino requerida"),

    // Horas y kilómetros
    timeWarning: z.string().min(1, "Hora de aviso requerida"),
    timeAtHome: z.union([
      z.string().min(1, "Hora llegada domicilio requerida"),
      z.literal(""),
    ]),
    timePickup: z.union([z.string().min(1), z.literal("")]).optional(),
    timeArrival: z.union([z.string().min(1), z.literal("")]).optional(),
    timeEnd: z
      .string()
      .refine(
        (val) =>
          val === "" ||
          val === "🔗 Anschluss" ||
          /^([01]\d|2[0-3]):([0-5]\d)$/.test(val),
        {
          message: "Debe ser una hora válida o '🔗 Anschluss'",
        },
      )
      .optional(),

    kmStart: z.union([z.number(), z.nan()]).optional(),
    kmEnd: z.union([z.number(), z.nan()]).optional(),

    // Estado del viaje
    wasCancelled: z.boolean(),
    cancelledAtPickup: z.boolean().optional(),
    countsTrip: z.union([z.literal(0), z.literal(1)]).default(1),

    // Notas
    reports: z.string().optional(),
    sentInSummary: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Solo si NO está cancelado, validamos campos obligatorios
    if (!data.wasCancelled) {
      if (!data.timePickup || data.timePickup.length < 1) {
        ctx.addIssue({
          path: ["timePickup"],
          code: "too_small",
          minimum: 1,
          type: "string",
          inclusive: true,
          message: "Hora carga paciente requerida",
        });
      }

      if (!data.timeArrival || data.timeArrival.length < 1) {
        ctx.addIssue({
          path: ["timeArrival"],
          code: "too_small",
          minimum: 1,
          type: "string",
          inclusive: true,
          message: "Hora de llegada destino requerida",
        });
      }

      if (!data.timeEnd || data.timeEnd.length < 1) {
        ctx.addIssue({
          path: ["timeEnd"],
          code: "too_small",
          minimum: 1,
          type: "string",
          inclusive: true,
          message: "Hora final requerida",
        });
      }

      if (typeof data.kmStart !== "number" || isNaN(data.kmStart)) {
        ctx.addIssue({
          path: ["kmStart"],
          code: "custom",
          message: "Km inicial requerido",
        });
      }

      if (typeof data.kmEnd !== "number" || isNaN(data.kmEnd)) {
        ctx.addIssue({
          path: ["kmEnd"],
          code: "custom",
          message: "Km final requerido",
        });
      }
    }
  });
