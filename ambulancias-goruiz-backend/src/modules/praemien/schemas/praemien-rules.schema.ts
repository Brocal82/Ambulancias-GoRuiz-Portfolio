import { z } from "zod";

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

const ruleBaseSchema = {
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().max(80).optional(),
  enabled: z.boolean(),
  multiplier: z.number().min(0).max(10),
};

const kmRuleSchema = z
  .object({
    ...ruleBaseSchema,
    type: z.literal("km"),
    minKm: z.number().min(0).max(10000),
    maxKm: z.number().min(0).max(10000).nullable().optional(),
  })
  .strict();

const weekdayRuleSchema = z
  .object({
    ...ruleBaseSchema,
    type: z.literal("weekday"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  })
  .strict();

const dienstStartTimeRuleSchema = z
  .object({
    ...ruleBaseSchema,
    type: z.literal("dienstStartTime"),
    startTimeFrom: timeStringSchema,
    startTimeTo: timeStringSchema,
  })
  .strict();

const weekdayDienstStartTimeRuleSchema = z
  .object({
    ...ruleBaseSchema,
    type: z.literal("weekdayDienstStartTime"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTimeFrom: timeStringSchema,
    startTimeTo: timeStringSchema,
  })
  .strict();

const weekdayPickupTimeRuleSchema = z
  .object({
    ...ruleBaseSchema,
    type: z.literal("weekdayPickupTime"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    pickupTimeFrom: timeStringSchema,
    pickupTimeTo: timeStringSchema,
  })
  .strict();

export const praemienRuleConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    rules: z
      .array(
        z.discriminatedUnion("type", [
          kmRuleSchema,
          weekdayRuleSchema,
          dienstStartTimeRuleSchema,
          weekdayDienstStartTimeRuleSchema,
          weekdayPickupTimeRuleSchema,
        ]),
      )
      .min(1)
      .max(30),
    cancelledTripPolicy: z.literal("excludeUnlessCountsTrip").default(
      "excludeUnlessCountsTrip",
    ),
  })
  .strict()
  .superRefine((config, ctx) => {
    config.rules.forEach((rule, index) => {
      if (rule.type === "km" && rule.maxKm != null && rule.maxKm < rule.minKm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", index, "maxKm"],
          message: "maxKm no puede ser menor que minKm",
        });
      }
      if (
        (rule.type === "dienstStartTime" ||
          rule.type === "weekdayDienstStartTime") &&
        rule.startTimeFrom > rule.startTimeTo
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", index, "startTimeTo"],
          message: "startTimeFrom no puede ser mayor que startTimeTo",
        });
      }
      if (
        rule.type === "weekdayPickupTime" &&
        rule.pickupTimeFrom > rule.pickupTimeTo
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", index, "pickupTimeTo"],
          message: "pickupTimeFrom no puede ser mayor que pickupTimeTo",
        });
      }
    });
  });

export type PraemienRuleConfigInput = z.infer<typeof praemienRuleConfigSchema>;
