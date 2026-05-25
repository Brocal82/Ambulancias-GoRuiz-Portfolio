import { z } from "zod";
import { DateTime } from "luxon";
import { ZONE } from "../../../utils/time";

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato YYYY-MM-DD")
  .refine(
    (val) => DateTime.fromISO(val, { zone: ZONE }).isValid,
    { message: "Fecha no válida" },
  );

export const weekStartDateBodySchema = z.object({
  weekStartDate: isoDateSchema,
});

export const dienstNumberWeekBodySchema = z.object({
  dienstNumber: z.coerce.number().int().min(1),
  weekStartDate: isoDateSchema,
});

export const assignTeamToWeekSchema = dienstNumberWeekBodySchema.extend({
  teamId: objectIdSchema,
  resolvedRoles: z
    .object({
      driverId: objectIdSchema,
      medicId: objectIdSchema,
    })
    .optional(),
});

export const assignUserToWeekSchema = dienstNumberWeekBodySchema.extend({
  userId: objectIdSchema,
  role: z.enum(["driver", "medic"]),
});

export const assignAmbulanceToWeekSchema = dienstNumberWeekBodySchema.extend({
  ambulanceId: objectIdSchema,
});

export const clearWeekPeopleSchema = dienstNumberWeekBodySchema;

export const removeAssignmentBodySchema = z.object({
  date: isoDateSchema,
});
