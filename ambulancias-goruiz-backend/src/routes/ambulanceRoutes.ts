import { Router } from "express";
import {
  getAllAmbulances,
  getAmbulanceById,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
} from "../controllers/ambulanceController";

import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";
import { validateBody } from "../middlewares/validateBody";
import { validateObjectId } from "../middlewares/validateObjectId";
import {
  createAmbulanceSchema,
  updateAmbulanceSchema,
} from "../schemas/ambulanceSchema";

const router = Router();

// 🟢 Rutas accesibles para cualquier usuario autenticado
router.get("/", authenticateToken, getAllAmbulances);
router.get("/:id", authenticateToken, validateObjectId("id"), getAmbulanceById);

// 🔒 Rutas protegidas para ADMIN únicamente
router.post(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  validateBody(createAmbulanceSchema),
  createAmbulance,
);
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateAmbulanceSchema),
  updateAmbulance,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteAmbulance,
);

export default router;
