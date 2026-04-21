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
import {
  adminGetManualDailyMonth,
  adminPostManualDailyApprove,
  adminPostManualDailyCorrectApprove,
  adminPostManualDailyReject,
  adminPostManualDailyReopen,
} from "./controllers/praemien-manual-daily-admin.controller";
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

/** Phase 4: admin review of worker manual daily entries (manual mode effective only). */
router.get(
  "/manual-daily/admin/month",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("admin"),
  adminGetManualDailyMonth,
);
router.post(
  "/manual-daily/admin/approve",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("admin"),
  adminPostManualDailyApprove,
);
router.post(
  "/manual-daily/admin/reject",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("admin"),
  adminPostManualDailyReject,
);
router.post(
  "/manual-daily/admin/correct-approve",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("admin"),
  adminPostManualDailyCorrectApprove,
);
router.post(
  "/manual-daily/admin/reopen",
  authenticateToken,
  requireModule(MODULE_KEYS.PRAEMIEN),
  authorizeRole("admin"),
  adminPostManualDailyReopen,
);

export default router;
