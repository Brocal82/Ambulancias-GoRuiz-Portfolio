import express from "express";
import {
  createTrip,
  getTripSetup,
  getTripsByDate,
  upsertTripSetup,
} from "./controllers/trips.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { tripSchema } from "./schemas/trip.schema";
import { tripSetupBodySchema } from "./schemas/trip-setup.schema";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  validateBody(tripSchema),
  createTrip,
);
router.get(
  "/date/:date",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  getTripsByDate,
);
router.get(
  "/setup/:assignmentId",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  validateObjectId("assignmentId"),
  getTripSetup,
);
router.put(
  "/setup/:assignmentId",
  authenticateToken,
  requireModule(MODULE_KEYS.WORKDAY),
  validateObjectId("assignmentId"),
  validateBody(tripSetupBodySchema),
  upsertTripSetup,
);

export default router;
