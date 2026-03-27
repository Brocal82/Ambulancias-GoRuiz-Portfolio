import { Router } from "express";
import {
  getMonthlyPraemienSummary,
  getPraemienMonthlyHistory,
} from "./controllers/praemien-read.controller";
import { saveMonthlyPraemie } from "./controllers/praemien-write.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";

const router = Router();

router.get("/monthly-summary", authenticateToken, getMonthlyPraemienSummary);
router.get("/monthly-history", authenticateToken, getPraemienMonthlyHistory);
router.post(
  "/save-monthly",
  authenticateToken,
  authorizeRole("admin"),
  saveMonthlyPraemie,
);

export default router;
