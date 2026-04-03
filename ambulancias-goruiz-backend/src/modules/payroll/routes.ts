import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  uploadPayrollDocument,
  uploadPayrollBatch,
  assignPayrollDocument,
  listPayrollDocumentsAdmin,
  listMyPayrollDocuments,
} from "./controllers/payroll.controller";

const router = express.Router();

// Admin: batch-upload up to 20 payslip PDFs in a single request (Phase 5).
// Each file is auto-matched independently; no manual workerId path.
// Unmatched files can be reassigned via PATCH /api/payroll/:id/assign.
// POST /api/payroll/upload/batch  (multipart field name: "payrolls", up to 20 files)
router.post(
  "/upload/batch",
  authenticateToken,
  authorizeRole("admin"),
  upload.array("payrolls", 20),
  uploadPayrollBatch,
);

// Admin: upload a payslip PDF.
//   - With workerId in body → manual assignment (Phase 1 path)
//   - Without workerId      → conservative filename auto-match (Phase 2 path)
// POST /api/payroll/upload  (multipart field name: "payroll")
router.post(
  "/upload",
  authenticateToken,
  authorizeRole("admin"),
  upload.single("payroll"),
  uploadPayrollDocument,
);

// Admin: assign (or re-assign) an unmatched document to a specific worker
// PATCH /api/payroll/:id/assign
router.patch(
  "/:id/assign",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  assignPayrollDocument,
);

// Admin: list all payroll documents scoped to their company
// GET /api/payroll
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  listPayrollDocumentsAdmin,
);

// Worker: list their own payroll documents
// GET /api/payroll/mine
router.get(
  "/mine",
  authenticateToken,
  listMyPayrollDocuments,
);

export default router;
