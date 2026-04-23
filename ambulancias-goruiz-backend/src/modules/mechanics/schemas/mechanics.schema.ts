import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Fecha inválida" },
);

/** multipart/form-data envía números como string */
const intFromFormSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return v;
}, z.number().int().positive());

const optionalNumberFromFormSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return v;
}, z.number().optional());

/** POST /api/mechanics/report-issue — JSON o multipart (Multer); alineado con MechanicsIssue */
export const reportIssueSchema = z.object({
  assignmentId: objectIdSchema,
  dienstNumber: intFromFormSchema,
  date: dateStringSchema,
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  team: z.string().optional(),
  ambulanceNumber: z.preprocess(
    (v) =>
      v === "" || v === null || v === undefined ? undefined : v,
    z.string().min(1, "ambulanceNumber requerido").optional(),
  ),
  ambulanceId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    objectIdSchema.optional(),
  ),
  finalKm: optionalNumberFromFormSchema,
  timestamp: z.string().min(1, "timestamp requerido"),
  issueText: z.string().min(1, "issueText requerido"),
  driver: objectIdSchema.optional(),
  medic: objectIdSchema.optional(),
});
