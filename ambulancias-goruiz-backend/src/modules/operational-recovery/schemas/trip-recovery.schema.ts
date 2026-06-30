/**
 * Phase 4.3 — Zod schemas for Trip Recovery Admin API.
 */
import { z } from "zod";
import { TRIP_CORRECTION_TYPE } from "../models/trip-correction.model";

const ALLOWED_PRAEMIEN_IMPACT = ["none", "possible"] as const;

const optionalNonNegativeNumber = z
  .number({ invalid_type_error: "Value must be a number" })
  .finite()
  .min(0)
  .optional();

const optionalCountsTrip = z.union([z.literal(0), z.literal(1)]).optional();

const effectiveFieldsSchema = z.object({
  effectiveCountsTrip: optionalCountsTrip,
  effectiveWasCancelled: z.boolean().optional(),
  effectiveCancelledAtPickup: z.boolean().optional(),
  effectiveKmStart: optionalNonNegativeNumber,
  effectiveKmEnd: optionalNonNegativeNumber,
  effectiveTimeWarning: z.string().trim().optional(),
  effectiveTimeAtHome: z.string().trim().optional(),
  effectiveTimePickup: z.string().trim().optional(),
  effectiveTimeArrival: z.string().trim().optional(),
  effectiveTimeEnd: z.string().trim().optional(),
});

const sharedBodySchema = z
  .object({
    reason: z
      .string({ required_error: "reason is required" })
      .min(1, { message: "reason is required" })
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: "reason is required" }),
    note: z
      .string()
      .max(500, { message: "note must be at most 500 characters" })
      .optional()
      .transform((s) => (s?.trim() || undefined)),
    praemienImpact: z.enum(ALLOWED_PRAEMIEN_IMPACT, {
      errorMap: () => ({ message: "praemienImpact must be 'none' or 'possible'" }),
    }),
  })
  .merge(effectiveFieldsSchema)
  .strict();

const tripLinkedBodySchema = sharedBodySchema
  .extend({
    correctionType: z.enum([
      TRIP_CORRECTION_TYPE.CORRECT,
      TRIP_CORRECTION_TYPE.VOID,
    ] as const),
    originalTripId: z
      .string({ required_error: "originalTripId is required" })
      .min(1, { message: "originalTripId is required" }),
    workdaySummaryId: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.correctionType === TRIP_CORRECTION_TYPE.CORRECT &&
      data.effectiveCountsTrip === undefined &&
      data.effectiveWasCancelled === undefined &&
      data.effectiveCancelledAtPickup === undefined &&
      data.effectiveKmStart === undefined &&
      data.effectiveKmEnd === undefined &&
      data.effectiveTimeWarning === undefined &&
      data.effectiveTimeAtHome === undefined &&
      data.effectiveTimePickup === undefined &&
      data.effectiveTimeArrival === undefined &&
      data.effectiveTimeEnd === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one effective field is required for correct corrections",
        path: ["effectiveCountsTrip"],
      });
    }
    if (
      data.effectiveKmStart != null &&
      data.effectiveKmEnd != null &&
      data.effectiveKmEnd < data.effectiveKmStart
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "effectiveKmEnd cannot be less than effectiveKmStart",
        path: ["effectiveKmEnd"],
      });
    }
  });

const addForgottenBodySchema = sharedBodySchema
  .extend({
    correctionType: z.literal(TRIP_CORRECTION_TYPE.ADD_FORGOTTEN),
    workdaySummaryId: z
      .string({ required_error: "workdaySummaryId is required" })
      .min(1, { message: "workdaySummaryId is required" }),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasEffective =
      data.effectiveCountsTrip !== undefined ||
      data.effectiveWasCancelled !== undefined ||
      data.effectiveCancelledAtPickup !== undefined ||
      data.effectiveKmStart !== undefined ||
      data.effectiveKmEnd !== undefined ||
      data.effectiveTimeWarning !== undefined ||
      data.effectiveTimeAtHome !== undefined ||
      data.effectiveTimePickup !== undefined ||
      data.effectiveTimeArrival !== undefined ||
      data.effectiveTimeEnd !== undefined;
    if (!hasEffective) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one effective field is required for add_forgotten corrections",
        path: ["effectiveCountsTrip"],
      });
    }
    if (
      data.effectiveKmStart != null &&
      data.effectiveKmEnd != null &&
      data.effectiveKmEnd < data.effectiveKmStart
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "effectiveKmEnd cannot be less than effectiveKmStart",
        path: ["effectiveKmEnd"],
      });
    }
  });

export const tripCorrectionBodySchema = z.union([
  tripLinkedBodySchema,
  addForgottenBodySchema,
]);

export type TripCorrectionBody = z.infer<typeof tripCorrectionBodySchema>;
