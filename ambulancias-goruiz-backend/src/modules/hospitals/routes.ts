import express from "express";
import {
  getAllHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "./controllers/hospitals.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  createHospitalSchema,
  updateHospitalSchema,
} from "./schemas/hospital.schema";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = express.Router();

// Accesible para cualquier usuario autenticado (worker + admin)
router.get("/", authenticateToken, requireModule(MODULE_KEYS.HOSPITALS), getAllHospitals);

// Solo admin
router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.HOSPITALS),
  authorizeRole("admin"),
  validateBody(createHospitalSchema),
  createHospital,
);
router.put(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.HOSPITALS),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateHospitalSchema),
  updateHospital,
);
router.patch(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.HOSPITALS),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateHospitalSchema),
  updateHospital,
);
router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.HOSPITALS),
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteHospital,
);

export default router;

