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
import { requireModule } from "../../middlewares/requireModule";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { validateBody } from "../../middlewares/validateBody";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import {
  finalClosureBodySchema,
  partialClosureBodySchema,
} from "./schemas/workday-summary.schema";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  validateBody(finalClosureBodySchema),
  createWorkdaySummary,
);
router.post(
  "/partial",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  validateBody(partialClosureBodySchema),
  submitPartialClosure,
);

router.get(
  "/count",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  authorizeRole("admin"),
  getSummariesCountByStatus,
);

router.patch(
  "/:id/review",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  authorizeRole("admin"),
  validateObjectId("id"),
  markSummaryReviewed,
);

router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  getAllWorkdaySummaries,
);

export default router;
