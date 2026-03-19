import express from "express";
import {
  getAllHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "./controllers/hospitals.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";

const router = express.Router();

// Accesible para cualquier usuario autenticado (worker + admin)
router.get("/", authenticateToken, getAllHospitals);

// Solo admin
router.post("/", authenticateToken, authorizeRole("admin"), createHospital);
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  updateHospital,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  updateHospital,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  deleteHospital,
);

export default router;

