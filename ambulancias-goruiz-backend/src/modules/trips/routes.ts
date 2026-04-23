import express from "express";
import { createTrip, getTripsByDate } from "./controllers/trips.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { tripSchema } from "./schemas/trip.schema";

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

export default router;
