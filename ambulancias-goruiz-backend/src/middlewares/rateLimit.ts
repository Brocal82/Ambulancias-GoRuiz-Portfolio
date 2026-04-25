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
