import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeSuperadmin } from "../../middlewares/roleMiddleware";
import {
  checkMyActiveSupportAccess,
  createSupportAccess,
  getSecurityMonitoringSummary,
  getSupportAccessRequests,
  reviewSupportAccess,
  revokeSupportAccess,
} from "./controllers/support-access.controller";

const router = express.Router();

router.use(authenticateToken, authorizeSuperadmin);

router.post("/requests", createSupportAccess);
router.get("/requests", getSupportAccessRequests);
router.post("/requests/:id/review", reviewSupportAccess);
router.post("/requests/:id/revoke", revokeSupportAccess);
router.get("/active", checkMyActiveSupportAccess);
router.get("/monitoring/daily-summary", getSecurityMonitoringSummary);

export default router;
