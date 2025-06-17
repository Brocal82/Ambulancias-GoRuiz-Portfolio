// backend/src/schemas/tripSchema.ts

import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

export const tripSchema = z.object({
  // IDs y datos base
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Fecha inválida",
  }),
  assignmentId: objectIdSchema,
  driver: objectIdSchema,
  medic: objectIdSchema,

  // Datos de traslado
  auftragNumber: z.string().min(1, "Número de Auftrag requerido"),
  patientName: z.string().min(1, "Nombre del paciente requerido"),
  fromAddress: z.string().min(1, "Dirección de origen requerida"),
  toAddress: z.string().min(1, "Dirección de destino requerida"),

  // Horas y km
  timeWarning: z.string().min(1, "Hora de aviso requerida"),
  timeAtHome: z.string().min(1, "Hora llegada domicilio requerida"),
  timePickup: z.string().min(1, "Hora carga paciente requerida"),
  timeArrival: z.string().min(1, "Hora de llegada destino requerida"),
  timeEnd: z.string().min(1, "Hora final requerida"),

  kmStart: z.number().nonnegative("Km inicial debe ser positivo"),
  kmEnd: z.number().nonnegative("Km final debe ser positivo"),

  // Lógica de conteo
  wasCancelled: z.boolean(),
  countsTrip: z
    .number()
    .int()
    .min(0)
    .max(1)
    .default(1),         // 🆕 0 ó 1

  // Comentarios opcionales
  reports: z.string().optional().default(""),
});



