import express from "express";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  getMyCompany,
  updateCompany,
  deleteCompany,
  getCompanyAdmins,
  getCompanySummary,
  getCompanyUsers,
  getGlobalMetrics,
  getCompanyMetrics,
} from "./controllers/companies.controller";
import {
  createFirstAdmin,
  createCompanyAdminInvitation,
} from "./controllers/company-admin.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeSuperadmin } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { requireStepUp } from "../../middlewares/requireStepUp";
import { AUDIT_EVENT } from "../../security/audit-events";
import { STEP_UP_ACTION } from "../../security/step-up-policy";
import {
  createCompanySchema,
  updateCompanySchema,
} from "./schemas/company.schema";
import { createCompanyAdminSchema } from "./schemas/create-admin.schema";
import { createCompanyAdminInvitationSchema } from "./schemas/create-admin-invitation.schema";

const router = express.Router();

router.get("/me", authenticateToken, getMyCompany);

router.use(authenticateToken, authorizeSuperadmin);

router.post(
  "/",
  requireStepUp({
    action: STEP_UP_ACTION.COMPANY_CREATE,
    event: AUDIT_EVENT.COMPANY_CREATED,
    resourceType: "company",
  }),
  validateBody(createCompanySchema),
  createCompany,
);
router.get("/metrics/global", getGlobalMetrics);
router.get("/", getAllCompanies);
router.get("/:id/metrics", validateObjectId("id"), getCompanyMetrics);
router.get("/:id/summary", validateObjectId("id"), getCompanySummary);
router.get("/:id/users", validateObjectId("id"), getCompanyUsers);
router.get("/:id/admins", validateObjectId("id"), getCompanyAdmins);
router.get("/:id", validateObjectId("id"), getCompanyById);
router.patch(
  "/:id",
  validateObjectId("id"),
  requireStepUp({
    action: STEP_UP_ACTION.COMPANY_SENSITIVE_UPDATE,
    event: AUDIT_EVENT.COMPANY_UPDATED,
    resourceType: "company",
    resourceIdFromReq: (req) => req.params.id,
    when: (req) => {
      const sensitiveFields = [
        "isActive",
        "emailDomain",
        "enabledModules",
        "praemienMode",
        "praemienModeEffectiveFrom",
        "praemienRules",
      ];
      return sensitiveFields.some((field) =>
        Object.prototype.hasOwnProperty.call(req.body ?? {}, field)
      );
    },
  }),
  validateBody(updateCompanySchema),
  updateCompany,
);
router.delete(
  "/:id",
  validateObjectId("id"),
  requireStepUp({
    action: STEP_UP_ACTION.COMPANY_DELETE,
    event: AUDIT_EVENT.COMPANY_DELETED,
    resourceType: "company",
    resourceIdFromReq: (req) => req.params.id,
  }),
  deleteCompany,
);

router.post(
  "/:id/admin",
  validateObjectId("id"),
  requireStepUp({
    action: STEP_UP_ACTION.COMPANY_ADMIN_CREATE,
    event: AUDIT_EVENT.COMPANY_ADMIN_CREATED,
    resourceType: "company",
    resourceIdFromReq: (req) => req.params.id,
  }),
  validateBody(createCompanyAdminSchema),
  createFirstAdmin,
);

router.post(
  "/:id/admin/invitation",
  validateObjectId("id"),
  requireStepUp({
    action: STEP_UP_ACTION.COMPANY_ADMIN_CREATE,
    event: AUDIT_EVENT.COMPANY_ADMIN_CREATED,
    resourceType: "company",
    resourceIdFromReq: (req) => req.params.id,
  }),
  validateBody(createCompanyAdminInvitationSchema),
  createCompanyAdminInvitation,
);

export default router;
