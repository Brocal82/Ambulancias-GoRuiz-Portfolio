import dotenv from "dotenv";
import { z } from "zod";

// En test: NUNCA cargar .env (evita contaminar con DB de desarrollo).
// jest.setup.js ya cargó .env.test antes de importar este módulo.
if (process.env.NODE_ENV !== "test") {
  dotenv.config();
}

const nonEmpty = z.string().trim().min(1);

const envSchema = z.object({
  // Críticas (fail-fast)
  // En test: MONGODB_URI_TEST es obligatorio; MONGODB_URI se ignora.
  MONGODB_URI: nonEmpty.optional(),
  MONGODB_URI_TEST: nonEmpty.optional(),
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
  JWT_EXPIRES_IN: z.string().trim().default("1h"),
  JWT_EXPIRES_IN_PRIVILEGED: z.string().trim().default("15m"),

  // Rate limiting (opcionales)
  RATE_LIMIT_LOGIN_MAX: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(5),
  RATE_LIMIT_LOGIN_WINDOW_MS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_REPORT_ISSUE_MAX: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(10),
  RATE_LIMIT_REPORT_ISSUE_WINDOW_MS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(60 * 1000), // 1 min
});

// Parseo y validación al importar (si falta algo crítico, el proceso debe fallar)
export const env = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    console.error("❌ Variables de entorno inválidas o faltantes:", formatted);
    process.exit(1);
  }

  const data = parsed.data;
  const isTest = process.env.NODE_ENV === "test";

  // En test: MONGODB_URI_TEST es obligatorio (DB aislada).
  if (isTest) {
    if (!data.MONGODB_URI_TEST) {
      console.error("❌ En NODE_ENV=test se requiere MONGODB_URI_TEST en .env.test");
      console.error("   Usa una DB dedicada para tests (ej: mongodb://localhost/ambulancias_test)");
      process.exit(1);
    }
  } else {
    // Desarrollo/producción: MONGODB_URI es obligatorio.
    if (!data.MONGODB_URI) {
      console.error("❌ MONGODB_URI es obligatorio en desarrollo y producción");
      process.exit(1);
    }
  }

  const MONGODB_URI = isTest ? data.MONGODB_URI_TEST! : data.MONGODB_URI!;

  return {
    ...data,
    MONGODB_URI,
  };
})();

