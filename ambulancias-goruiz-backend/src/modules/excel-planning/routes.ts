import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { uploadExcelOnly } from "../../middlewares/uploadMiddleware";
import { rateLimitExcelPlanningImport } from "../../middlewares/rateLimit";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import {
  putExcelPlanningTemplateSchema,
  publishExcelImportSchema,
  postExcelExportSchema,
} from "./schemas/excel-planning.schemas";
import {
  getTemplate,
  putTemplate,
  postImport,
  postExport,
  getImport,
  postPublishImport,
  deleteImportDraft,
  listWeeks,
  getWeek,
  getMyWeek,
} from "./controllers/excel-planning.controller";

const router = Router();

router.get(
  "/template",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  getTemplate,
);

router.put(
  "/template",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  validateBody(putExcelPlanningTemplateSchema),
  putTemplate,
);

router.post(
  "/imports",
  rateLimitExcelPlanningImport,
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  uploadExcelOnly.single("file"),
  postImport,
);

router.post(
  "/export",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  validateBody(postExcelExportSchema),
  postExport,
);

router.get(
  "/imports/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  validateObjectId("id"),
  getImport,
);

router.post(
  "/imports/:id/publish",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(publishExcelImportSchema),
  postPublishImport,
);

router.delete(
  "/imports/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteImportDraft,
);

router.get(
  "/weeks",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  listWeeks,
);

router.get(
  "/weeks/:weekStart",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("admin"),
  getWeek,
);

router.get(
  "/me",
  authenticateToken,
  requireModule(MODULE_KEYS.EXCEL_PLANNING),
  authorizeRole("worker"),
  getMyWeek,
);

export default router;
