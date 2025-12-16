//src/schemas/dienstQuerySchema.ts
import { z } from "zod";

export const dienstQuerySchema = z.object({
  dienstNumber: z.string().optional(), // lo convertiremos a número si se envía
  weekStartDate: z.string().optional(),
  date: z.string().optional(),
  driver: z.string().optional(),
  medic: z.string().optional(),
});
