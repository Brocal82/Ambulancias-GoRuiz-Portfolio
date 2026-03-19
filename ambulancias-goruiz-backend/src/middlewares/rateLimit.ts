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
 * Rate limit para report-issue. Evita spam de reportes.
 * Default: 10 reportes por minuto por IP.
 */
export const rateLimitReportIssue = rateLimit({
  windowMs: env.RATE_LIMIT_REPORT_ISSUE_WINDOW_MS,
  limit: env.RATE_LIMIT_REPORT_ISSUE_MAX,
  message: jsonMessage("Demasiados reportes. Intente más tarde."),
  standardHeaders: true,
  legacyHeaders: false,
});
