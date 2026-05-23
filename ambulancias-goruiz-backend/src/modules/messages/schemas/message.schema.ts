import { z } from "zod";
import {
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_MAX_ATTACHMENTS,
  MESSAGE_SUBJECT_MAX_LENGTH,
} from "../constants/message-limits";

/** ObjectId MongoDB: 24 hex chars */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

/** Coerce toAllWorkers desde form-data ("true"/"false"/"1"/1) */
const toAllWorkersSchema = z.preprocess(
  (v) => {
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    if (v === undefined || v === null || v === "") return false;
    return v;
  },
  z.boolean(),
);

function dedupeRecipientIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/messages — Crear mensaje (multipart/form-data)
 * Multer popula req.body con los campos del form antes de validateBody
 * ───────────────────────────────────────────────────────────────────────────── */
export const messageSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(1, "subject requerido")
      .max(MESSAGE_SUBJECT_MAX_LENGTH, {
        message: `subject no puede superar ${MESSAGE_SUBJECT_MAX_LENGTH} caracteres`,
      }),
    body: z
      .string()
      .trim()
      .min(1, "body requerido")
      .max(MESSAGE_BODY_MAX_LENGTH, {
        message: `body no puede superar ${MESSAGE_BODY_MAX_LENGTH} caracteres`,
      }),
    toAllWorkers: toAllWorkersSchema.optional().default(false),
    recipients: z
      .preprocess(
        (v) => {
          if (Array.isArray(v)) return dedupeRecipientIds(v as string[]);
          if (typeof v === "string") {
            try {
              const parsed = JSON.parse(v);
              return Array.isArray(parsed)
                ? dedupeRecipientIds(parsed as string[])
                : v
                  ? dedupeRecipientIds([v])
                  : [];
            } catch {
              const parts = v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              return dedupeRecipientIds(parts);
            }
          }
          return [];
        },
        z.array(objectIdSchema),
      )
      .optional()
      .default([]),
  })
  .refine(
    (data) => {
      if (data.toAllWorkers) return true;
      return Array.isArray(data.recipients) && data.recipients.length >= 1;
    },
    {
      message:
        "Si toAllWorkers no es true, recipients debe tener al menos un elemento",
      path: ["recipients"],
    },
  );

export { MESSAGE_MAX_ATTACHMENTS };
