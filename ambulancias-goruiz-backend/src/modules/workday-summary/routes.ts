import express from "express";
import {
  createWorkdaySummary,
  submitPartialClosure,
  getAllWorkdaySummaries,
  getSummariesCountByStatus,
  markSummaryReviewed,
} from "./controllers/workday-summary.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";

const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);
router.post("/partial", authenticateToken, submitPartialClosure);

router.get(
  "/count",
  authenticateToken,
  authorizeRole("admin"),
  getSummariesCountByStatus,
);

router.patch(
  "/:id/review",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  markSummaryReviewed,
);

router.get("/", authenticateToken, getAllWorkdaySummaries);

export default router;
