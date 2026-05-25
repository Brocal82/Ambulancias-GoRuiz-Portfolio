// modules/diensts/schemas/dienstQuerySchema.ts
import { z } from "zod";
import { isoDateSchema, objectIdSchema } from "./shared.schema";

export const dienstQuerySchema = z.object({
  dienstNumber: z.string().optional(),
  weekStartDate: isoDateSchema.optional(),
  date: isoDateSchema.optional(),
  driver: objectIdSchema.optional(),
  medic: objectIdSchema.optional(),
});
