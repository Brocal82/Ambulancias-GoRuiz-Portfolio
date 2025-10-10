//src/schemas/dienstSchema.ts
import { z } from 'zod';

// Validar que es un ObjectId válido de MongoDB
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de Mongo inválido');

export const assignmentSchema = z.object({
  date: z.string().refine(
    (val) => !isNaN(Date.parse(val)) || val.startsWith('template-'),
    { message: 'Fecha no válida' }
  ),
  ambulanceId: objectIdSchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  driver: objectIdSchema,
  medic: objectIdSchema,
});


export const dienstSchema = z.object({
  dienstNumber: z.number().int().min(1),
  weekStartDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de inicio no válida',
    })
    .optional(),
  weekEndDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de fin no válida',
    })
    .optional(),
  assignments: z.array(assignmentSchema),
});

export const partialDienstSchema = dienstSchema.partial();
