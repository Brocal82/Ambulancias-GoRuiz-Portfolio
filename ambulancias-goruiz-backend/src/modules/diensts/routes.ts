// modules/diensts/routes.ts
import express from "express";

import {
  DienstAssignments,
  DienstCalendar,
  DienstLifecycle,
} from "./index";
import { dienstTemplateRoutes } from "../dienst-templates";

import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { updateDienstPartialSchema } from "./assignments/schemas/update-dienst-partial.schema";
import { moveSlotSameWeekSchema } from "./assignments/schemas/move-slot-same-week.schema";
import { dndCrossDienstSameWeekSchema } from "./assignments/schemas/dnd-cross-dienst-same-week.schema";

const router = express.Router();

// 👮‍♂️ Rutas protegidas
router.post("/", authenticateToken, authorizeRole("admin"), DienstLifecycle.createDienst);
router.get("/", authenticateToken, authorizeRole("admin"), DienstCalendar.getAllDiensts);
router.get("/search", authenticateToken, authorizeRole("admin"), DienstCalendar.searchDienst);
router.get("/user/:userId", authenticateToken, DienstCalendar.getDienstsByUser);

router.get(
  "/assigned-days/:userId",
  authenticateToken,
  DienstAssignments.getAssignedDaysForUser,
);

router.post(
  "/generate-week",
  authenticateToken,
  authorizeRole("admin"),
  DienstLifecycle.generateDienstTemplatesForWeek,
);
router.post(
  "/delete-week",
  authenticateToken,
  authorizeRole("admin"),
  DienstLifecycle.deleteDienstsForWeek,
);

// CRUD de plantillas DienstTemplate (solo admin)
router.use("/templates", dienstTemplateRoutes);

// 👇 Acceso según permisos
router.get("/:id", authenticateToken, validateObjectId("id"), DienstCalendar.getDienstById);
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstLifecycle.updateDienst,
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
  validateBody(updateDienstPartialSchema),
  DienstAssignments.updateDienstPartial,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstLifecycle.deleteDienst,
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

router.post(
  "/move-slot-same-week",
  authenticateToken,
  authorizeRole("admin"),
  validateBody(moveSlotSameWeekSchema),
  DienstAssignments.moveSlotSameWeek,
);

router.post(
  "/dnd-cross-dienst-same-week",
  authenticateToken,
  authorizeRole("admin"),
  validateBody(dndCrossDienstSameWeekSchema),
  DienstAssignments.dndCrossDienstSameWeek,
);

export default router;
