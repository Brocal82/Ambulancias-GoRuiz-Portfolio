import express from "express";
import multer from "multer";
import type { ErrorRequestHandler } from "express";
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
import { uploadImagesOnly } from "../../middlewares/uploadMiddleware";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { reportIssueSchema } from "./schemas/mechanics.schema";

const router = express.Router();

router.get(
  "/issues/count",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole(["admin", "jefe_mecanicos", "mecanico"]),
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
  validateBody(reportIssueSchema),
  reportIssue,
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
