import { Router } from "express";
import {
  getAllAmbulances,
  getAmbulanceById,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
} from "./controllers/ambulances.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import {
  createAmbulanceSchema,
  updateAmbulanceSchema,
} from "./schemas/ambulance.schema";

const router = Router();

router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.AMBULANCES),
  getAllAmbulances,
);
router.get(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.AMBULANCES),
  validateObjectId("id"),
  getAmbulanceById,
);

router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.AMBULANCES),
  authorizeRole(["admin", "jefe_mecanicos"]),
  validateBody(createAmbulanceSchema),
  createAmbulance
);
router.put(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.AMBULANCES),
  authorizeRole(["admin", "jefe_mecanicos"]),
  validateObjectId("id"),
  validateBody(updateAmbulanceSchema),
  updateAmbulance
);
router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.AMBULANCES),
  authorizeRole(["admin", "jefe_mecanicos"]),
  validateObjectId("id"),
  deleteAmbulance
);

export default router;
