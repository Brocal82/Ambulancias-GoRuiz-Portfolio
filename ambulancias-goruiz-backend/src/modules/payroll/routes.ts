import express from "express";
import multer from "multer";
import type { ErrorRequestHandler } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { uploadPdfOnly } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  uploadPayrollDocument,
  uploadPayrollBatch,
  assignPayrollDocument,
  invalidatePayrollDocument,
  listPayrollDocumentsAdmin,
  listMyPayrollDocuments,
  checkPayrollCoverage,
  getPayrollCoverageYearSummary,
} from "./controllers/payroll.controller";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = express.Router();

// Admin: batch-upload up to 20 payslip PDFs in a single request (Phase 5).
// Each file is auto-matched independently; no manual workerId path.
// Unmatched files can be reassigned via PATCH /api/payroll/:id/assign.
// POST /api/payroll/upload/batch  (multipart field name: "payrolls", up to 20 files)
router.post(
  "/upload/batch",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  uploadPdfOnly.array("payrolls", 20),
  uploadPayrollBatch,
);

// Admin: upload a payslip PDF.
//   - With workerId in body → manual assignment (Phase 1 path)
//   - Without workerId      → conservative filename auto-match (Phase 2 path)
// POST /api/payroll/upload  (multipart field name: "payroll")
router.post(
  "/upload",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  uploadPdfOnly.single("payroll"),
  uploadPayrollDocument,
);

// Admin: assign (or re-assign) a document to a specific worker
// PATCH /api/payroll/:id/assign
router.patch(
  "/:id/assign",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  validateObjectId("id"),
  assignPayrollDocument,
);

// Admin: soft-delete (invalidate) a payroll document
// Sets deletedAt = now. The document and its file are retained for future restore.
// PATCH /api/payroll/:id/invalidate
router.patch(
  "/:id/invalidate",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  validateObjectId("id"),
  invalidatePayrollDocument,
);

// Admin: coverage check — which workers have no confirmed payroll for a period
// GET /api/payroll/missing?year=YYYY&month=M
// Must be registered before GET / to be explicit (no dynamic segment conflict here,
// but ordering makes intent clear).
router.get(
  "/coverage/year",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  getPayrollCoverageYearSummary,
);

router.get(
  "/missing",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  checkPayrollCoverage,
);

// Admin: list all payroll documents scoped to their company
// GET /api/payroll
router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole("admin"),
  listPayrollDocumentsAdmin,
);

// Employee roles: list own payroll documents (worker, mecanico, jefe_mecanicos, jefe_logistica).
// Admins use GET /api/payroll (admin list).
// GET /api/payroll/mine
router.get(
  "/mine",
  authenticateToken,
  requireModule(MODULE_KEYS.PAYROLL),
  authorizeRole(["worker", "mecanico", "jefe_mecanicos", "jefe_logistica"]),
  listMyPayrollDocuments,
);

const multerErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: `Upload error: ${err.message}` });
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

  res.status(500).json({ message: "Unexpected server error" });
};

router.use(multerErrorHandler);

export default router;
