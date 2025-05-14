import { z } from 'zod';

export const dienstSchema = z.object({
  dienstNumber: z.number().int().min(1),
  weekStartDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Fecha de inicio no válida',
  }),
  weekEndDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Fecha de fin no válida',
  }),
  assignments: z.array(
    z.object({
      date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Fecha no válida',
      }),
      vehicleNumber: z.string().min(1),
      startTime: z.string().min(1),
      endTime: z.string().min(1),
      driver: z.string().min(1),
      medic: z.string().min(1),
    })
  ),
});
