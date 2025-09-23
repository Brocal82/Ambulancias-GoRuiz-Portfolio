import express from "express";
import {
  createWorkdaySummary,
  submitPartialClosure,
  getAllWorkdaySummaries,
  reportIssue,
  getAllIssueReports,
  deleteIssueReport,
  getSummariesCountByStatus,
  markSummaryReviewed, // 👈 NUEVO
} from "../controllers/workdaySummaryController";
import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";

const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);
router.post("/partial", authenticateToken, submitPartialClosure);

// 🔵 Nuevo: contador derivado (ya añadido en pasos previos)
router.get("/count", authenticateToken, authorizeRole("admin"), getSummariesCountByStatus);

// 🔵 NUEVO: marcar como revisado
router.patch("/:id/review", authenticateToken, authorizeRole("admin"), markSummaryReviewed);

router.get("/", authenticateToken, getAllWorkdaySummaries);
router.post("/report-issue", reportIssue);
router.get("/issues", getAllIssueReports);
router.delete("/issues/:id", authenticateToken, authorizeRole("admin"), deleteIssueReport);

export default router;
