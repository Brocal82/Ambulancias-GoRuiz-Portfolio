import express from "express";
import { createWorkdaySummary } from "../controllers/workdaySummaryController";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authenticateToken, createWorkdaySummary);

export default router;
