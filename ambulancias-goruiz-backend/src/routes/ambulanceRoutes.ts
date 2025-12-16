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

const router = Router();

// 🟢 Rutas accesibles para cualquier usuario autenticado
router.get("/", authenticateToken, getAllAmbulances);
router.get("/:id", authenticateToken, getAmbulanceById);

// 🔒 Rutas protegidas para ADMIN únicamente
router.post("/", authenticateToken, authorizeRole("admin"), createAmbulance);
router.put("/:id", authenticateToken, authorizeRole("admin"), updateAmbulance);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  deleteAmbulance,
);

export default router;
