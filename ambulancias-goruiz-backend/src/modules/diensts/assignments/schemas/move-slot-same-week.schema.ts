import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

export const moveSlotSameWeekSchema = z.object({
  sourceDienstId: objectIdSchema,
  sourceDate: z.string().min(1),
  targetDienstId: objectIdSchema,
  targetDate: z.string().min(1),
  role: z.enum(["driver", "medic"]),
  userId: objectIdSchema,
});
