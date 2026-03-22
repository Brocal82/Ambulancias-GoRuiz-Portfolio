import { z } from "zod";

/** ObjectId MongoDB: 24 hex chars */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de Mongo inválido" });

const rotationModeSchema = z.enum(["rotating", "fixed", "none"]);

/** Acepta number o string (coerción); usado cuando rotationMode === "fixed" */
const fixedDienstNumberSchema = z.preprocess(
  (v) => (typeof v === "string" ? Number(v) : v),
  z.number().int().min(1),
);

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/teams — Crear equipo
 * ───────────────────────────────────────────────────────────────────────────── */
export const createTeamSchema = z
  .object({
    driver: objectIdSchema,
    medic: objectIdSchema,
    rotationMode: rotationModeSchema.optional(),
    fixedDienstNumber: fixedDienstNumberSchema.optional(),
    ambulanceId: z.union([objectIdSchema, z.null()]).optional(),
  })
  .refine((data) => data.driver !== data.medic, {
    message: "driver y medic no pueden ser la misma persona",
    path: ["medic"],
  })
  .refine(
    (data) => {
      if (data.rotationMode !== "fixed") return true;
      return (
        data.fixedDienstNumber !== undefined &&
        Number.isInteger(data.fixedDienstNumber) &&
        (data.fixedDienstNumber ?? 0) >= 1
      );
    },
    {
      message:
        'fixedDienstNumber debe ser un número entero ≥ 1 cuando rotationMode es "fixed"',
      path: ["fixedDienstNumber"],
    },
  );

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/teams/:id — Actualizar equipo (campos opcionales)
 * ───────────────────────────────────────────────────────────────────────────── */
export const updateTeamSchema = z
  .object({
    driver: objectIdSchema.optional(),
    medic: objectIdSchema.optional(),
    rotationMode: rotationModeSchema.optional(),
    fixedDienstNumber: z
      .preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int().min(1))
      .optional()
      .nullable(),
    ambulanceId: z.union([objectIdSchema, z.null()]).optional(),
  })
  .refine(
    (data) => {
      if (data.driver === undefined || data.medic === undefined) return true;
      return data.driver !== data.medic;
    },
    {
      message: "driver y medic no pueden ser la misma persona",
      path: ["medic"],
    },
  )
  .refine(
    (data) => {
      if (data.rotationMode !== "fixed") return true;
      const num = data.fixedDienstNumber;
      if (num === undefined || num === null) return false;
      return Number.isInteger(num) && num >= 1;
    },
    {
      message:
        'fixedDienstNumber debe ser un número entero ≥ 1 cuando rotationMode es "fixed"',
      path: ["fixedDienstNumber"],
    },
  );
