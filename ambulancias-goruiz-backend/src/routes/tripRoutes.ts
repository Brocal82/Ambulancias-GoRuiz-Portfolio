// backend/src/routes/tripRoutes.ts

import express from "express";
import { createTrip, getTripsByDate } from "../controllers/tripController";
import { authenticateToken } from "../middlewares/authMiddleware";
import { validateBody } from "../middlewares/validateBody";
import { tripSchema } from "../schemas/tripSchema";

const router = express.Router();

// Crear un nuevo viaje (protegido por token)
router.post("/", authenticateToken, validateBody(tripSchema), createTrip);
// backend/src/routes/tripRoutes.ts o tripsRoutes.ts
router.get("/date/:date", authenticateToken, getTripsByDate);

export default router;
