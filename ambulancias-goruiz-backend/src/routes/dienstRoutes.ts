//src/routes/dienstRoutes.ts
import express from "express";

import {
  DienstAssignments,
  DienstCalendar,
  DienstTemplates,
} from "../modules/diensts";
import { dienstTemplateRoutes } from "../modules/dienst-templates";

import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";
import { validateObjectId } from "../middlewares/validateObjectId";

const router = express.Router();

// 👮‍♂️ Rutas protegidas
router.post("/", authenticateToken, authorizeRole("admin"), DienstTemplates.createDienst);
router.get("/", authenticateToken, authorizeRole("admin"), DienstCalendar.getAllDiensts);
router.get("/search", authenticateToken, authorizeRole("admin"), DienstCalendar.searchDienst);
router.get(
  "/user/:userId",
  authenticateToken,
  validateObjectId("userId"),
  DienstCalendar.getDienstsByUser,
);

// ✅ NUEVA RUTA - antes de las que usan :id
router.get(
  "/assigned-days/:userId",
  authenticateToken,
  validateObjectId("userId"),
  DienstAssignments.getAssignedDaysForUser,
);

router.post(
  "/generate-week",
  authenticateToken,
  authorizeRole("admin"),
  DienstTemplates.generateDienstTemplatesForWeek,
);
router.post(
  "/delete-week",
  authenticateToken,
  authorizeRole("admin"),
  DienstTemplates.deleteDienstsForWeek,
);

// 📌 Rutas para plantillas de Dienst (solo admin) — las dejamos legacy por ahora
router.use("/templates", dienstTemplateRoutes);

// 👇 Acceso según permisos
router.get("/:id", authenticateToken, validateObjectId("id"), DienstCalendar.getDienstById);
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstTemplates.updateDienst,
);

// ✅ Nueva ruta para eliminar un assignment específico
router.patch(
  "/:id/remove-assignment",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstAssignments.removeAssignment,
);

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstAssignments.updateDienstPartial,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstTemplates.deleteDienst,
);

// Asignar un Team completo a todos los días de una semana (solo admin)
router.post(
  "/assign-team-to-week",
  authenticateToken,
  authorizeRole("admin"),
  DienstAssignments.assignTeamToWeek,
);

// Asignar UN usuario (driver/medic) a toda la semana de un Dienst
router.post(
  "/assign-user-to-week",
  authenticateToken,
  authorizeRole("admin"),
  DienstAssignments.assignUserToWeek,
);

router.post(
  "/clear-week-people",
  authenticateToken,
  authorizeRole("admin"),
  DienstAssignments.clearPeopleForWeek,
);

export default router;
