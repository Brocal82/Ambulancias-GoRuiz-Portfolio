import express from "express";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
} from "./controllers/companies.controller";
import { createFirstAdmin } from "./controllers/company-admin.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeSuperadmin } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  createCompanySchema,
  updateCompanySchema,
} from "./schemas/company.schema";
import { createCompanyAdminSchema } from "./schemas/create-admin.schema";

const router = express.Router();

router.use(authenticateToken, authorizeSuperadmin);

router.post("/", validateBody(createCompanySchema), createCompany);
router.get("/", getAllCompanies);
router.get("/:id", validateObjectId("id"), getCompanyById);
router.patch("/:id", validateObjectId("id"), validateBody(updateCompanySchema), updateCompany);

router.post(
  "/:id/admin",
  validateObjectId("id"),
  validateBody(createCompanyAdminSchema),
  createFirstAdmin,
);

export default router;
