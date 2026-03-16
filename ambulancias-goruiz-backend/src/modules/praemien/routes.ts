import { Router } from "express";
import {
  getMonthlyPraemienSummary,
  getPraemienMonthlyHistory,
} from "./controllers/praemien-read.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";

const router = Router();

router.get("/monthly-summary", authenticateToken, getMonthlyPraemienSummary);
router.get("/monthly-history", authenticateToken, getPraemienMonthlyHistory);

export default router;
