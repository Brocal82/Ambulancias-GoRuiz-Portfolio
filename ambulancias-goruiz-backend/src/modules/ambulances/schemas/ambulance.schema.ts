import { z } from "zod";

const nonEmptyString = z
  .string()
  .trim()
  .min(1, "Campo obligatorio")
  .max(100, "Máximo 100 caracteres");

/**
 * Schema para crear ambulancia. Todos los campos obligatorios.
 * .strict() rechaza propiedades no definidas.
 */
export const createAmbulanceSchema = z
  .object({
    brand: nonEmptyString,
    modelName: nonEmptyString,
    licensePlate: nonEmptyString,
    ambulanceNumber: nonEmptyString,
  })
  .strict();

/**
 * Schema para actualizar ambulancia. Todos los campos opcionales.
 * Si se envía un campo, debe ser no vacío.
 * .strict() rechaza propiedades no definidas.
 */
export const updateAmbulanceSchema = z
  .object({
    brand: nonEmptyString.optional(),
    modelName: nonEmptyString.optional(),
    licensePlate: nonEmptyString.optional(),
    ambulanceNumber: nonEmptyString.optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).length > 0 &&
      Object.values(data).some((v) => v !== undefined && v !== ""),
    { message: "Debe enviar al menos un campo para actualizar" },
  );
