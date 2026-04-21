import { Router } from "express";
import {
  getMonthlyPraemienSummary,
  getPraemienMonthlyHistory,
} from "./controllers/praemien-read.controller";
import { saveMonthlyPraemie } from "./controllers/praemien-write.controller";
import {
  getMyManualDailyEntriesMonth,
  getMyManualDailyEntryDay,
  putMyManualDailyEntry,
} from "./controllers/praemien-manual-daily.controller";
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

/** Phase 3: worker manual daily values (only when company manual mode is effective). */
router.put(
  "/manual-daily",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("worker"),
  putMyManualDailyEntry,
);
router.get(
  "/manual-daily/month",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("worker"),
  getMyManualDailyEntriesMonth,
);
router.get(
  "/manual-daily/day",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("worker"),
  getMyManualDailyEntryDay,
);

export default router;
