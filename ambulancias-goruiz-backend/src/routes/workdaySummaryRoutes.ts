import express from "express";
import {
  createWorkdaySummary,
  submitPartialClosure,
  getAllWorkdaySummaries,
  reportIssue,
  getAllIssueReports,
  deleteIssueReport,
  getSummariesCountByStatus,
  markSummaryReviewed,
  getIssuesCount, // 👈 NUEVO import
} from "../controllers/workdaySummaryController";
import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";

const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);
router.post("/partial", authenticateToken, submitPartialClosure);

// 🔵 Contador derivado de resúmenes pendientes
router.get("/count", authenticateToken, authorizeRole("admin"), getSummariesCountByStatus);

// 🟠 Contador derivado de averías (por defecto status=open)
router.get("/issues/count", authenticateToken, authorizeRole("admin"), getIssuesCount); // 👈 NUEVA ruta

// 🔵 Marcar resumen como revisado
router.patch("/:id/review", authenticateToken, authorizeRole("admin"), markSummaryReviewed);

router.get("/", authenticateToken, getAllWorkdaySummaries);
router.post("/report-issue", reportIssue);
router.get("/issues", getAllIssueReports);
router.delete("/issues/:id", authenticateToken, authorizeRole("admin"), deleteIssueReport);

export default router;
