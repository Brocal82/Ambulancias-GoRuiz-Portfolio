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
import { requireModule } from "../../middlewares/requireModule";
import { MODULE_KEYS } from "../companies/constants/modules.constants";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import { updateDienstPartialSchema } from "./assignments/schemas/update-dienst-partial.schema";
import { moveSlotSameWeekSchema } from "./assignments/schemas/move-slot-same-week.schema";
import { dndCrossDienstSameWeekSchema } from "./assignments/schemas/dnd-cross-dienst-same-week.schema";
import {
  weekStartDateBodySchema,
  assignTeamToWeekSchema,
  assignUserToWeekSchema,
  assignAmbulanceToWeekSchema,
  clearWeekPeopleSchema,
  removeAssignmentBodySchema,
} from "./schemas/shared.schema";

const router = express.Router();

// 👮‍♂️ Rutas protegidas (módulo `scheduling`: diensts + plantillas bajo /templates)
router.post(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  DienstLifecycle.createDienst,
);
router.get(
  "/",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  DienstCalendar.getAllDiensts,
);
router.get(
  "/search",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  DienstCalendar.searchDienst,
);
router.get(
  "/user/:userId",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  DienstCalendar.getDienstsByUser,
);

router.get(
  "/assigned-days/:userId",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  DienstAssignments.getAssignedDaysForUser,
);

router.post(
  "/generate-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  requireModule(MODULE_KEYS.TEAMS),
  authorizeRole("admin"),
  validateBody(weekStartDateBodySchema),
  DienstLifecycle.generateDienstTemplatesForWeek,
);
router.post(
  "/delete-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateBody(weekStartDateBodySchema),
  DienstLifecycle.deleteDienstsForWeek,
);

// Asignaciones semanales (rutas literales antes de /:id)
router.post(
  "/assign-team-to-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  requireModule(MODULE_KEYS.TEAMS),
  authorizeRole("admin"),
  validateBody(assignTeamToWeekSchema),
  DienstAssignments.assignTeamToWeek,
);

router.post(
  "/assign-user-to-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateBody(assignUserToWeekSchema),
  DienstAssignments.assignUserToWeek,
);

router.post(
  "/clear-week-people",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateBody(clearWeekPeopleSchema),
  DienstAssignments.clearPeopleForWeek,
);

router.post(
  "/move-slot-same-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateBody(moveSlotSameWeekSchema),
  DienstAssignments.moveSlotSameWeek,
);

router.post(
  "/dnd-cross-dienst-same-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateBody(dndCrossDienstSameWeekSchema),
  DienstAssignments.dndCrossDienstSameWeek,
);

router.post(
  "/assign-ambulance-to-week",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  requireModule(MODULE_KEYS.AMBULANCES),
  validateBody(assignAmbulanceToWeekSchema),
  DienstAssignments.assignAmbulanceToWeek,
);

// CRUD de plantillas DienstTemplate (solo admin)
router.use("/templates", dienstTemplateRoutes);

// 👇 Acceso según permisos
router.get(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  validateObjectId("id"),
  DienstCalendar.getDienstById,
);
router.put(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstLifecycle.updateDienst,
);

// ✅ Nueva ruta para eliminar un assignment específico
router.patch(
  "/:id/remove-assignment",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(removeAssignmentBodySchema),
  DienstAssignments.removeAssignment,
);

router.patch(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateDienstPartialSchema),
  DienstAssignments.updateDienstPartial,
);
router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.SCHEDULING),
  authorizeRole("admin"),
  validateObjectId("id"),
  DienstLifecycle.deleteDienst,
);

export default router;
