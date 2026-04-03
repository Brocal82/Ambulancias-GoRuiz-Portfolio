import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { upload } from "../../middlewares/uploadMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  uploadPayrollDocument,
  assignPayrollDocument,
  listPayrollDocumentsAdmin,
  listMyPayrollDocuments,
} from "./controllers/payroll.controller";

const router = express.Router();

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
