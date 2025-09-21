import express from "express";
import {
  createWorkdaySummary,
  submitPartialClosure,
  getAllWorkdaySummaries,
  reportIssue,
  getAllIssueReports,
  deleteIssueReport,
} from "../controllers/workdaySummaryController";
import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware"; // 👈 importa tu middleware

const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);
router.post("/partial", authenticateToken, submitPartialClosure);
router.get("/", authenticateToken, getAllWorkdaySummaries);
router.post("/report-issue", reportIssue);
router.get("/issues", getAllIssueReports);

// 👇 SOLO admin puede borrar
router.delete("/issues/:id", authenticateToken, authorizeRole("admin"), deleteIssueReport);

export default router;
