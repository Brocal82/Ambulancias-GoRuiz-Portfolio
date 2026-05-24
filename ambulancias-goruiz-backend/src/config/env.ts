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
  SUPERADMIN_MFA_REQUIRED: z
    .preprocess(
      (v) => {
        if (v === undefined || v === "") return false;
        if (typeof v === "boolean") return v;
        return String(v).toLowerCase() === "true";
      },
      z.boolean(),
    )
    .default(false),
  SUPERADMIN_MFA_ISSUER: z.string().trim().default("AmbulanciasGoRuiz"),
  STEP_UP_SESSION_TTL_SECONDS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(60).max(1800).optional(),
    )
    .default(300),
  SECURITY_MONITORING_ENABLED: z
    .preprocess(
      (v) => {
        if (v === undefined || v === "") return true;
        if (typeof v === "boolean") return v;
        return String(v).toLowerCase() !== "false";
      },
      z.boolean(),
    )
    .default(true),
  SECURITY_MONITORING_CRON: z.string().trim().default("0 7 * * *"),
  SECURITY_MONITORING_DENIED_THRESHOLD: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(3),
  SECURITY_AUDIT_LOG_RETENTION_DAYS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(180),
  /** Optional HTTPS endpoint for SIEM/Slack-style routing of security alerts. */
  SECURITY_ALERT_WEBHOOK_URL: z.string().trim().optional(),
  /** JIT break-glass: 1 = operador único; 2 = dos superadmins distintos (cuatro ojos). */
  SUPPORT_ACCESS_APPROVALS_REQUIRED: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).max(2).optional(),
    )
    .default(1),
  /** Cron for expiring stale approved support-access requests (default: every 15 min). */
  SUPPORT_ACCESS_EXPIRATION_CRON: z.string().trim().default("*/15 * * * *"),

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

  // Global API rate limit — applied to all /api/* routes for authenticated requests.
  // Set high enough to not impact normal usage; protects against scraping/abuse.
  RATE_LIMIT_GLOBAL_MAX: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(300), // 300 req / min per IP
  RATE_LIMIT_GLOBAL_WINDOW_MS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(60 * 1000), // 1 min

  RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(12),
  RATE_LIMIT_SUPPORT_ACCESS_CREATE_WINDOW_MS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(15 * 60 * 1000),
  RATE_LIMIT_SUPPORT_ACCESS_REVIEW_MAX: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(20),
  RATE_LIMIT_SUPPORT_ACCESS_REVIEW_WINDOW_MS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(15 * 60 * 1000),
  RATE_LIMIT_SUPPORT_ACCESS_REVOKE_MAX: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    )
    .default(10),
  RATE_LIMIT_SUPPORT_ACCESS_REVOKE_WINDOW_MS: z
    .preprocess(
      (v) => (v === undefined || v === "" ? undefined : Number(v)),
      z.number().int().positive().optional(),
    )
    .default(15 * 60 * 1000),
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

