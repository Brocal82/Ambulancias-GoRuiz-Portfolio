//src/routes/dienstRoutes.ts
import express from "express";

import {
  DienstAssignments,
  DienstCalendar,
  DienstTemplates,
} from "../modules/diensts";

import {
  getDienstTemplates,
  createDienstTemplate,
  updateDienstTemplate,
  deleteDienstTemplate,
} from "../modules/dienst-templates/controllers";

import { authenticateToken } from "../middlewares/authMiddleware";
import { authorizeRole } from "../middlewares/roleMiddleware";

const router = express.Router();

// 👮‍♂️ Rutas protegidas
router.post("/", authenticateToken, authorizeRole("admin"), DienstTemplates.createDienst);
router.get("/", authenticateToken, authorizeRole("admin"), DienstCalendar.getAllDiensts);
router.get("/search", authenticateToken, authorizeRole("admin"), DienstCalendar.searchDienst);
router.get("/user/:userId", authenticateToken, DienstCalendar.getDienstsByUser);

// ✅ NUEVA RUTA - antes de las que usan :id
router.get(
  "/assigned-days/:userId",
  authenticateToken,
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
router.get(
  "/templates",
  authenticateToken,
  authorizeRole("admin"),
  getDienstTemplates,
);

router.post(
  "/templates",
  authenticateToken,
  authorizeRole("admin"),
  createDienstTemplate,
);

router.put(
  "/templates/:id",
  authenticateToken,
  authorizeRole("admin"),
  updateDienstTemplate,
);

router.delete(
  "/templates/:id",
  authenticateToken,
  authorizeRole("admin"),
  deleteDienstTemplate,
);

// 👇 Acceso según permisos
router.get("/:id", authenticateToken, DienstCalendar.getDienstById);
router.put("/:id", authenticateToken, authorizeRole("admin"), DienstTemplates.updateDienst);

// ✅ Nueva ruta para eliminar un assignment específico
router.patch(
  "/:id/remove-assignment",
  authenticateToken,
  authorizeRole("admin"),
  DienstAssignments.removeAssignment,
);

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  DienstAssignments.updateDienstPartial,
);
router.delete("/:id", authenticateToken, authorizeRole("admin"), DienstTemplates.deleteDienst);

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
