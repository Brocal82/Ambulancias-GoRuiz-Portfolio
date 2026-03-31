import { z } from "zod";

/** Mismo contrato que move-slot-same-week (cuerpo idéntico). */
export const dndCrossDienstSameWeekSchema = z.object({
  sourceDienstId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido"),
  sourceDate: z.string().min(1),
  targetDienstId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido"),
  targetDate: z.string().min(1),
  role: z.enum(["driver", "medic"]),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido"),
});
