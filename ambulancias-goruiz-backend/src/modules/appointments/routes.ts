// backend/src/modules/appointments/routes.ts
import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { requireModule } from "../../middlewares/requireModule";
import { validateBody } from "../../middlewares/validateBody";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  requestAppointment,
  getMyAppointments,
  getPendingAppointments,
  proposeSlots,
  selectSlot,
  rejectProposal,
  getCalendarAppointments,
  updateAppointment,
  cancelAppointment,
  deleteMyAppointment,
  getAppointmentsCount,
  getOpenAppointments,
} from "./controllers/appointments.controller";
import {
  requestAppointmentSchema,
  proposeSlotsSchema,
  selectSlotSchema,
  updateAppointmentSchema,
} from "./schemas/appointment.schema";
import { MODULE_KEYS } from "../companies/constants/modules.constants";

const router = Router();

// Worker: crear solicitud -> pending
router.post(
  "/requests",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("worker"),
  validateBody(requestAppointmentSchema),
  requestAppointment,
);

// Worker: listar mis citas
router.get(
  "/my",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("worker"),
  getMyAppointments,
);

// Admin: listar pendientes
router.get(
  "/pending",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  getPendingAppointments,
);

// Admin: listar pendientes + propuestas
router.get(
  "/open",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  getOpenAppointments,
);

// Admin: contar por estado (derivado). Por defecto status=pending
router.get(
  "/count",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  getAppointmentsCount,
);

// Worker: elegir slot -> confirmed
router.post(
  "/:id/select",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("worker"),
  validateObjectId("id"),
  validateBody(selectSlotSchema),
  selectSlot,
);

// Worker: rechazar propuesta -> vuelve a pending para nueva propuesta admin
router.post(
  "/:id/reject-proposal",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("worker"),
  validateObjectId("id"),
  rejectProposal,
);

// Admin: proponer hasta 3 slots -> proposed
router.post(
  "/:id/propose",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(proposeSlotsSchema),
  proposeSlots,
);

// Admin: calendario de confirmadas/rescheduled en rango
router.get(
  "/calendar",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  getCalendarAppointments,
);

// Admin: editar (motivo/detalles y/o reprogramar -> rescheduled)
router.patch(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  validateObjectId("id"),
  validateBody(updateAppointmentSchema),
  updateAppointment,
);

// Worker: eliminar su propia cita
router.delete(
  "/:id/my",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("worker"),
  validateObjectId("id"),
  deleteMyAppointment,
);

// Admin: cancelar -> cancelled
router.delete(
  "/:id",
  authenticateToken,
  requireModule(MODULE_KEYS.APPOINTMENTS),
  authorizeRole("admin"),
  validateObjectId("id"),
  cancelAppointment,
);

export default router;
