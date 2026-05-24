// backend/src/middlewares/rateLimit.ts
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";

const jsonMessage = (msg: string) => ({ message: msg });

/**
 * Rate limit estricto para login. Protege contra brute force.
 * Default: 5 intentos por 15 min por IP.
 */
export const rateLimitLogin = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  message: jsonMessage("Demasiados intentos de inicio de sesión. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit para POST /api/mechanics/report-issue. Evita spam de reportes.
 * Default: 10 reportes por minuto por IP.
 */
export const rateLimitReportIssue = rateLimit({
  windowMs: env.RATE_LIMIT_REPORT_ISSUE_WINDOW_MS,
  limit: env.RATE_LIMIT_REPORT_ISSUE_MAX,
  message: jsonMessage("Demasiados reportes. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit para aceptar invitación. Protege contra abuso de creación de cuentas.
 * 8 requests / 15 min por IP. Deshabilitado en test.
 */
export const rateLimitInvitationAccept = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: jsonMessage("Demasiados intentos de registro. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limit para validar invitación. Evita enumeración/fuerza bruta de tokens.
 * 25 requests / minuto por IP. Deshabilitado en test.
 */
export const rateLimitInvitationValidate = rateLimit({
  windowMs: 60 * 1000,
  limit: 25,
  message: jsonMessage("Demasiadas solicitudes de validación. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limit para POST /api/excel-planning/imports (subida de Excel).
 * Evita abuso de CPU/disco y escaneos repetidos. Deshabilitado en test.
 */
export const rateLimitExcelPlanningImport = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 25,
  message: jsonMessage("Demasiadas importaciones de Excel. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limit para POST /api/messages. Evita spam de mensajes y adjuntos.
 * 30 mensajes / minuto por IP. Deshabilitado en test.
 */
export const rateLimitMessages = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: jsonMessage("Demasiados mensajes enviados. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limit para endpoints de subida de archivos (P-Schein, foto de perfil,
 * documentos batch). Evita abuso de almacenamiento y CPU.
 * 10 subidas / 5 min por IP. Deshabilitado en test.
 */
export const rateLimitUpload = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  message: jsonMessage("Demasiadas subidas de archivos. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limit global aplicado a todas las rutas /api/*.
 * Protege contra scraping y abuso de endpoints autenticados.
 * El límite es deliberadamente alto (default: 300 req/min) para no
 * afectar el uso normal; ajustable via RATE_LIMIT_GLOBAL_MAX en .env.
 * Deshabilitado en test.
 */
export const rateLimitGlobal = rateLimit({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  message: jsonMessage("Demasiadas solicitudes. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

function skipSupportAccessRateLimitInTest(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.SUPPORT_ACCESS_RATE_LIMIT_TEST !== "1"
  );
}

export const supportAccessRateLimitConfig = {
  create: {
    max: env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX,
    windowMs: env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_WINDOW_MS,
  },
  review: {
    max: env.RATE_LIMIT_SUPPORT_ACCESS_REVIEW_MAX,
    windowMs: env.RATE_LIMIT_SUPPORT_ACCESS_REVIEW_WINDOW_MS,
  },
  revoke: {
    max: env.RATE_LIMIT_SUPPORT_ACCESS_REVOKE_MAX,
    windowMs: env.RATE_LIMIT_SUPPORT_ACCESS_REVOKE_WINDOW_MS,
  },
} as const;

/**
 * Rate limit for POST /api/support-access/requests.
 * Default: 12 requests / 15 min per IP.
 */
export const rateLimitSupportAccessCreate = rateLimit({
  windowMs: env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_WINDOW_MS,
  limit: env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX,
  message: jsonMessage("Demasiadas solicitudes de acceso soporte. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipSupportAccessRateLimitInTest,
});

/**
 * Rate limit for POST /api/support-access/requests/:id/review.
 * Default: 20 reviews / 15 min per IP.
 */
export const rateLimitSupportAccessReview = rateLimit({
  windowMs: env.RATE_LIMIT_SUPPORT_ACCESS_REVIEW_WINDOW_MS,
  limit: env.RATE_LIMIT_SUPPORT_ACCESS_REVIEW_MAX,
  message: jsonMessage("Demasiadas revisiones de acceso soporte. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipSupportAccessRateLimitInTest,
});

/**
 * Rate limit for POST /api/support-access/requests/:id/revoke.
 * Default: 10 revocations / 15 min per IP.
 */
export const rateLimitSupportAccessRevoke = rateLimit({
  windowMs: env.RATE_LIMIT_SUPPORT_ACCESS_REVOKE_WINDOW_MS,
  limit: env.RATE_LIMIT_SUPPORT_ACCESS_REVOKE_MAX,
  message: jsonMessage("Demasiadas revocaciones de acceso soporte. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipSupportAccessRateLimitInTest,
});
