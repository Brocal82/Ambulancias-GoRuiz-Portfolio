import dotenv from "dotenv";
import { z } from "zod";

// Cargar .env UNA sola vez, lo antes posible
dotenv.config();

const nonEmpty = z.string().trim().min(1);

const envSchema = z.object({
  // Críticas (fail-fast)
  MONGODB_URI: nonEmpty,
  JWT_SECRET: nonEmpty,

  // Opcionales / con defaults
  PORT: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(5000),

  FRONTEND_URL: z.string().trim().optional(),
  ALLOWED_ORIGINS: z.string().trim().optional(),

  PSCHEIN_WARNING_MONTHS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(0).optional(),
    )
    .default(6),

  NODE_ENV: z.string().trim().optional(),
});

// Parseo y validación al importar (si falta algo crítico, el proceso debe fallar)
export const env = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Mensaje legible para despliegues (Render, etc.)
    const formatted = parsed.error.flatten().fieldErrors;
    // eslint-disable-next-line no-console
    console.error("❌ Variables de entorno inválidas o faltantes:", formatted);
    process.exit(1);
  }
  return parsed.data;
})();

