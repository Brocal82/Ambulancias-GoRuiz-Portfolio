//backend/src/routes/workdaySummaryRoutes.ts
import express from "express";
import { createWorkdaySummary, submitPartialClosure, getAllWorkdaySummaries, reportIssue, getAllIssueReports } from "../controllers/workdaySummaryController";
import { authenticateToken } from "../middlewares/authMiddleware";


const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);
router.post('/partial', authenticateToken, submitPartialClosure);
router.get("/", authenticateToken, getAllWorkdaySummaries);
router.post("/report-issue", reportIssue);
router.get("/issues", getAllIssueReports);


export default router;
