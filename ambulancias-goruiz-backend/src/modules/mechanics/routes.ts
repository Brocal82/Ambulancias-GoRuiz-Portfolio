import express from "express";
import {
  reportIssue,
  getAllIssueReports,
  deleteIssueReport,
  getIssuesCount,
  markIssueSeen,
} from "./controllers/mechanics.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { reportIssueSchema } from "./schemas/mechanics.schema";

const router = express.Router();

router.get(
  "/issues/count",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole("admin"),
  getIssuesCount,
);

router.patch(
  "/issues/:id/seen",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole("admin"),
  validateObjectId("id"),
  markIssueSeen,
);

router.post(
  "/report-issue",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  validateBody(reportIssueSchema),
  reportIssue,
);

router.get(
  "/issues",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole("admin"),
  getAllIssueReports,
);

router.delete(
  "/issues/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.MECHANICS),
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteIssueReport,
);

export default router;
