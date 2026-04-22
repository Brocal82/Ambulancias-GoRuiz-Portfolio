import type { RequestHandler, Router } from "express";
import {
  reportIssue,
  getAllIssueReports,
  deleteIssueReport,
  getIssuesCount,
  markIssueSeen,
} from "./controllers/mechanics.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { reportIssueSchema } from "./schemas/mechanics.schema";

export type RegisterMechanicsIssueRoutesOptions = {
  /**
   * Si true, añade cabeceras Deprecation + Link (RFC 9745 / MDN) para clientes
   * que aún llaman bajo /api/workday-summary/*. Migrar a /api/mechanics/*.
   */
  deprecate?: boolean;
};

/**
 * Cabeceras en rutas legacy; no alteran el cuerpo ni códigos de éxito.
 */
function mechanicsDeprecationHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader(
      "Link",
      '</api/mechanics/report-issue>; rel="successor-version"',
    );
    next();
  };
}

/** Registra las rutas HTTP de averías (mismo comportamiento bajo /api/mechanics o prefijo legacy). */
export function registerMechanicsIssueRoutes(
  router: Router,
  options?: RegisterMechanicsIssueRoutesOptions,
): void {
  const pre: RequestHandler[] = options?.deprecate ? [mechanicsDeprecationHeaders()] : [];

  router.get(
    "/issues/count",
    ...pre,
    authenticateToken,
    requireModule(MODULE_KEYS.MECHANICS),
    authorizeRole("admin"),
    getIssuesCount,
  );

  router.patch(
    "/issues/:id/seen",
    ...pre,
    authenticateToken,
    requireModule(MODULE_KEYS.MECHANICS),
    authorizeRole("admin"),
    validateObjectId("id"),
    markIssueSeen,
  );

  router.post(
    "/report-issue",
    ...pre,
    authenticateToken,
    requireModule(MODULE_KEYS.MECHANICS),
    validateBody(reportIssueSchema),
    reportIssue,
  );

  router.get(
    "/issues",
    ...pre,
    authenticateToken,
    requireModule(MODULE_KEYS.MECHANICS),
    authorizeRole("admin"),
    getAllIssueReports,
  );

  router.delete(
    "/issues/:id",
    ...pre,
    authenticateToken,
    requireModule(MODULE_KEYS.MECHANICS),
    authorizeRole("admin"),
    validateObjectId("id"),
    deleteIssueReport,
  );
}
