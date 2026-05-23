import { z } from "zod";

const objectIdString = z
  .string()
  .trim()
  .min(1)
  .refine((s) => /^[a-fA-F0-9]{24}$/.test(s), "ID inválido");

const optionalObjectId = z.preprocess(
  (val) =>
    val === "" || val === null || val === undefined ? undefined : val,
  objectIdString.optional(),
);

export const createMechanicsWorkOrderSchema = z.object({
  ambulanceId: objectIdString,
  title: z.string().trim().min(1, "Título requerido").max(200),
  description: z.string().trim().max(4000).optional(),
  plannedFor: z.coerce.date().optional(),
  assignedTo: optionalObjectId,
});

const statusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const patchMechanicsWorkOrderAdminSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).optional().nullable(),
    plannedFor: z.union([z.null(), z.coerce.date()]).optional(),
    assignedTo: z.preprocess(
      (val) => (val === "" ? null : val),
      z.union([objectIdString, z.null()]).optional(),
    ),
    status: statusEnum.optional(),
    completionNotes: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Debes enviar al menos un campo a actualizar",
  });

export const patchMechanicsWorkOrderMechanicSchema = z
  .object({
    status: z.enum(["in_progress", "completed"]),
    completionNotes: z.string().trim().max(4000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "completed") {
      const n = (data.completionNotes ?? "").trim();
      if (n.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las notas de cierre son obligatorias (mín. 3 caracteres)",
          path: ["completionNotes"],
        });
      }
    }
  });

/** GET /api/mechanics/work-orders — filtro opcional por ambulancia */
export const listWorkOrdersQuerySchema = z.object({
  ambulanceId: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    objectIdString.optional(),
  ),
});
