import express from "express";
import { createTrip, getTripsByDate } from "./controllers/trips.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { tripSchema } from "./schemas/trip.schema";

const router = express.Router();

router.post("/", authenticateToken, validateBody(tripSchema), createTrip);
router.get("/date/:date", authenticateToken, getTripsByDate);

export default router;
