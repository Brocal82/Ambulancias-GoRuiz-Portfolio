import { Router } from "express";
import {
  getMonthlyPraemienSummary,
  getPraemienMonthlyHistory,
} from "./controllers/praemien-read.controller";
import { saveMonthlyPraemie } from "./controllers/praemien-write.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = Router();

router.get(
  "/monthly-summary",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  getMonthlyPraemienSummary,
);
router.get(
  "/monthly-history",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  getPraemienMonthlyHistory,
);
router.post(
  "/save-monthly",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("admin"),
  saveMonthlyPraemie,
);

export default router;
