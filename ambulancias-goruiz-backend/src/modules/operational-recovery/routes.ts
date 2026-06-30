/**
 * Phase 2.3 — Operational Recovery HTTP routes.
 *
 * All routes: authenticated admin + scheduling module required.
 */
import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import {
  scanInconsistencies,
  repairInconsistencies,
} from "./controllers/absence-cleanup-monitor.controller";
import {
  createTripCorrectionHandler,
  getEffectiveTripsByWorkdaySummaryHandler,
  previewTripCorrectionHandler,
} from "./controllers/trip-recovery.controller";
import { tripCorrectionBodySchema } from "./schemas/trip-recovery.schema";

const router = express.Router();

router.get(
  "/absence-cleanup",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  scanInconsistencies,
);

router.post(
  "/absence-cleanup/repair",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  repairInconsistencies,
);

// ── Phase 4.3: Trip Recovery Admin API ───────────────────────────────────────

router.post(
  "/trip-corrections/preview",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  authorizeRole("admin"),
  validateBody(tripCorrectionBodySchema),
  previewTripCorrectionHandler,
);

router.post(
  "/trip-corrections",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  authorizeRole("admin"),
  validateBody(tripCorrectionBodySchema),
  createTripCorrectionHandler,
);

router.get(
  "/workday-summaries/:workdaySummaryId/effective-trips",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  authorizeRole("admin"),
  validateObjectId("workdaySummaryId"),
  getEffectiveTripsByWorkdaySummaryHandler,
);

export default router;
