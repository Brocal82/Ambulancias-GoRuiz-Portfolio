import express from "express";
import {
  getAllHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "./controllers/hospitals.controller";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { updateHospitalSchema } from "./schemas/hospital.schema";

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
  validateBody(updateHospitalSchema),
  updateHospital,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateHospitalSchema),
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

