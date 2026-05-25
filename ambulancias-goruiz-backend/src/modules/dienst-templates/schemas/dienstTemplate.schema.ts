import { z } from "zod";

const timeHHmmSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (use HH:mm)");

const dayIndexSchema = z.number().int().min(0).max(6);

export const dayScheduleSchema = z.object({
  dayIndex: dayIndexSchema,
  startTime: timeHHmmSchema.optional(),
  endTime: timeHHmmSchema.optional(),
  isOff: z.boolean(),
});

function assertNoDuplicateDayIndices<T extends { dayIndex: number }>(
  items: T[],
  ctx: z.RefinementCtx,
  path: string,
): void {
  const seen = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    const idx = items[i]!.dayIndex;
    if (seen.has(idx)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dayIndex duplicado en perDaySchedule",
        path: [path, i, "dayIndex"],
      });
      return;
    }
    seen.add(idx);
  }
}

function assertNoDuplicateDaysOff(
  daysOff: number[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<number>();
  for (let i = 0; i < daysOff.length; i++) {
    const d = daysOff[i]!;
    if (seen.has(d)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "daysOff contiene días duplicados",
        path: ["daysOff", i],
      });
      return;
    }
    seen.add(d);
  }
}

const dienstTemplateBaseSchema = z.object({
  dienstNumber: z.coerce.number().int().min(1),
  startTime: timeHHmmSchema,
  endTime: timeHHmmSchema,
  daysOff: z.array(dayIndexSchema),
  isActive: z.boolean().optional(),
  perDaySchedule: z.array(dayScheduleSchema).optional(),
});

export const dienstTemplateCreateSchema = dienstTemplateBaseSchema.superRefine(
  (data, ctx) => {
    assertNoDuplicateDaysOff(data.daysOff, ctx);
    if (data.perDaySchedule) {
      assertNoDuplicateDayIndices(data.perDaySchedule, ctx, "perDaySchedule");
    }
  },
);

export const dienstTemplateUpdateSchema = dienstTemplateBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.daysOff) {
      assertNoDuplicateDaysOff(data.daysOff, ctx);
    }
    if (data.perDaySchedule) {
      assertNoDuplicateDayIndices(data.perDaySchedule, ctx, "perDaySchedule");
    }
  });
