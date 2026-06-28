/**
 * Phase 2.3 — Operational Recovery HTTP routes.
 *
 * All routes: authenticated admin + scheduling module required.
 */
import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import {
  scanInconsistencies,
  repairInconsistencies,
} from "./controllers/absence-cleanup-monitor.controller";

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

export default router;
