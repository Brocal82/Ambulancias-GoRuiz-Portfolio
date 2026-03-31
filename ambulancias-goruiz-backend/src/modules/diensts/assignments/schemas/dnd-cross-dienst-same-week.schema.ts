import { z } from "zod";

/**
 * role = slot de origen (limpieza en source).
 * targetRole opcional = slot en destino; si falta, coincide con role (comportamiento anterior).
 */
export const dndCrossDienstSameWeekSchema = z.object({
  sourceDienstId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido"),
  sourceDate: z.string().min(1),
  targetDienstId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido"),
  targetDate: z.string().min(1),
  role: z.enum(["driver", "medic"]),
  targetRole: z.enum(["driver", "medic"]).optional(),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido"),
});

/** Igual que el resultado de `validateBody(dndCrossDienstSameWeekSchema)` en runtime. */
export type DndCrossDienstSameWeekBody = z.infer<typeof dndCrossDienstSameWeekSchema>;
