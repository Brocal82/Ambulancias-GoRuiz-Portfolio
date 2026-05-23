import express from "express";
import multer from "multer";
import type { ErrorRequestHandler } from "express";
import {
  reportIssue,
  getAllIssueReports,
  getMyIssueReports,
  deleteIssueReport,
  getIssuesCount,
  markIssueSeen,
} from "./controllers/mechanics.controller";
import {
  createWorkOrder,
  listWorkOrders,
  getWorkOrderById,
  patchWorkOrder,
} from "./controllers/mechanics-work-orders.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateBody, validateBodyWithUploadCleanup } from "../../middlewares/validateBody";
import { validateQuery } from "../../middlewares/validateQuery";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { requireModule } from "../../middlewares/requireModule";
import { uploadImagesOnly } from "../../middlewares/uploadMiddleware";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { reportIssueSchema, issuesCountQuerySchema } from "./schemas/mechanics.schema";
import {
  createMechanicsWorkOrderSchema,
  listWorkOrdersQuerySchema,
} from "./schemas/mechanics-work-order.schema";

const router = express.Router();

router.post(
  "/work-orders",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos"]),
  validateBody(createMechanicsWorkOrderSchema),
  createWorkOrder,
);

router.get(
  "/work-orders",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
  validateQuery(listWorkOrdersQuerySchema),
  listWorkOrders,
);

router.get(
  "/work-orders/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
  validateObjectId("id"),
  getWorkOrderById,
);

router.patch(
  "/work-orders/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
  validateObjectId("id"),
  patchWorkOrder,
);

router.get(
  "/issues/count",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
  validateQuery(issuesCountQuerySchema),
  getIssuesCount,
);

router.patch(
  "/issues/:id/seen",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
  validateObjectId("id"),
  markIssueSeen,
);

router.post(
  "/report-issue",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  uploadImagesOnly.array("photos", 5),
  validateBodyWithUploadCleanup(reportIssueSchema),
  reportIssue,
);

router.get(
  "/issues/mine",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  getMyIssueReports,
);

router.get(
  "/issues",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
  getAllIssueReports,
);

router.delete(
  "/issues/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos"]),
  validateObjectId("id"),
  deleteIssueReport,
);

const mechanicsMulterErrorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  next,
) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: `Error de subida: ${err.message}` });
    return;
  }

  if (
    err &&
    typeof err.message === "string" &&
    err.message.includes("Tipo de archivo no permitido")
  ) {
    res.status(400).json({ message: err.message });
    return;
  }

  next(err);
};

router.use(mechanicsMulterErrorHandler);

export default router;
