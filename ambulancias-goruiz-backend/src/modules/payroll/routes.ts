import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { upload } from "../../middlewares/uploadMiddleware";
import {
  uploadPayrollDocument,
  listPayrollDocumentsAdmin,
  listMyPayrollDocuments,
} from "./controllers/payroll.controller";

const router = express.Router();

// Admin: upload a payslip PDF for a specific worker
// POST /api/payroll/upload  (multipart field name: "payroll")
router.post(
  "/upload",
  authenticateToken,
  authorizeRole("admin"),
  upload.single("payroll"),
  uploadPayrollDocument,
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
