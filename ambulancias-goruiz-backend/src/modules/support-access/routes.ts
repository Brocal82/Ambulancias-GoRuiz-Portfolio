import express from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeSuperadmin } from "../../middlewares/roleMiddleware";
import { requireStepUp } from "../../middlewares/requireStepUp";
import { AUDIT_EVENT } from "../../security/audit-events";
import { STEP_UP_ACTION } from "../../security/step-up-policy";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  checkMyActiveSupportAccess,
  createSupportAccess,
  getSecurityMonitoringSummary,
  getSecurityAuditLogs,
  getSecurityMonitoringOperationalHealth,
  getSecurityTenantRisk,
  getSecurityMonthlyReview,
  getSupportAccessRequests,
  reviewSupportAccess,
  revokeSupportAccess,
} from "./controllers/support-access.controller";

const router = express.Router();

router.use(authenticateToken, authorizeSuperadmin);

router.post("/requests", createSupportAccess);
router.get("/requests", getSupportAccessRequests);
router.post(
  "/requests/:id/review",
  validateObjectId("id"),
  requireStepUp({
    action: STEP_UP_ACTION.SUPPORT_ACCESS_APPROVE,
    event: AUDIT_EVENT.SUPPORT_ACCESS_APPROVAL_RECORDED,
    resourceType: "support_access_request",
    resourceIdFromReq: (req) => req.params.id,
    when: (req) => Boolean(req.body?.approve),
  }),
  reviewSupportAccess,
);
router.post("/requests/:id/revoke", revokeSupportAccess);
router.get("/active", checkMyActiveSupportAccess);
router.get("/monitoring/daily-summary", getSecurityMonitoringSummary);
router.get("/monitoring/audit-logs", getSecurityAuditLogs);
router.get("/monitoring/health", getSecurityMonitoringOperationalHealth);
router.get("/monitoring/tenant-risk", getSecurityTenantRisk);
router.get("/monitoring/monthly-review", getSecurityMonthlyReview);

export default router;
