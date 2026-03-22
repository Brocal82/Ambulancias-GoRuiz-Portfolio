// backend/src/modules/appointments/routes.ts
import { Router } from "express";
import { authenticateToken } from "../../middlewares/authMiddleware";
import { authorizeRole } from "../../middlewares/roleMiddleware";
import { validateObjectId } from "../../middlewares/validateObjectId";
import {
  requestAppointment,
  getMyAppointments,
  getPendingAppointments,
  proposeSlots,
  selectSlot,
  getCalendarAppointments,
  updateAppointment,
  cancelAppointment,
  deleteMyAppointment,
  getAppointmentsCount,
  getOpenAppointments,
} from "./controllers/appointments.controller";

const router = Router();

// Worker: crear solicitud -> pending
router.post(
  "/requests",
  authenticateToken,
  authorizeRole("worker"),
  requestAppointment,
);

// Worker: listar mis citas
router.get(
  "/my",
  authenticateToken,
  authorizeRole("worker"),
  getMyAppointments,
);

// Admin: listar pendientes
router.get(
  "/pending",
  authenticateToken,
  authorizeRole("admin"),
  getPendingAppointments,
);

// Admin: listar pendientes + propuestas
router.get(
  "/open",
  authenticateToken,
  authorizeRole("admin"),
  getOpenAppointments,
);

// Admin: contar por estado (derivado). Por defecto status=pending
router.get(
  "/count",
  authenticateToken,
  authorizeRole("admin"),
  getAppointmentsCount,
);

// Worker: elegir slot -> confirmed
router.post(
  "/:id/select",
  authenticateToken,
  authorizeRole("worker"),
  validateObjectId("id"),
  selectSlot,
);

// Admin: proponer hasta 3 slots -> proposed
router.post(
  "/:id/propose",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  proposeSlots,
);

// Admin: calendario de confirmadas/rescheduled en rango
router.get(
  "/calendar",
  authenticateToken,
  authorizeRole("admin"),
  getCalendarAppointments,
);

// Admin: editar (motivo/detalles y/o reprogramar -> rescheduled)
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  updateAppointment,
);

// Worker: eliminar su propia cita si está cancelada o ya pasó
router.delete(
  "/:id/my",
  authenticateToken,
  authorizeRole("worker"),
  validateObjectId("id"),
  deleteMyAppointment,
);

// Admin: cancelar -> cancelled
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  validateObjectId("id"),
  cancelAppointment,
);

export default router;
