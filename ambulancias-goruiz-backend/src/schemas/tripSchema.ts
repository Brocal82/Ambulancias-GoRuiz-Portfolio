// backend/src/schemas/tripSchema.ts

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'ID de Mongo inválido',
});

export const tripSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Fecha inválida',
  }),
  assignmentId: objectIdSchema,
  driver: objectIdSchema,
  medic: objectIdSchema,
  auftragNumber: z.string().min(1, 'Número de Auftrag requerido'),
  patientName: z.string().min(1, 'Nombre del paciente requerido'),
  fromAddress: z.string().min(1, 'Dirección de origen requerida'),
  toAddress: z.string().min(1, 'Dirección de destino requerida'),
  timeWarning: z.string().min(1, 'Hora de aviso requerida'),
  timePickup: z.string().min(1, 'Hora de recogida requerida'),
  timeArrival: z.string().min(1, 'Hora de llegada requerida'),
  timeEnd: z.string().min(1, 'Hora final requerida'),
  kmStart: z.number().nonnegative('Km inicial debe ser positivo'),
  kmEnd: z.number().nonnegative('Km final debe ser positivo'),
  wasCancelled: z.boolean(),
  cancelledAtPickup: z.boolean().optional().default(false),
  reports: z.string().optional().default(""), // ✅ AÑADIDO
});

