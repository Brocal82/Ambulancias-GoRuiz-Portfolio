// backend/src/routes/appointmentRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
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
} from '../controllers/appointmentController';

const router = Router();

// Worker: crear solicitud -> pending
router.post('/requests', authenticateToken, authorizeRole('worker'), requestAppointment);

// Worker: listar mis citas
router.get('/my', authenticateToken, authorizeRole('worker'), getMyAppointments);

// Admin: listar pendientes
router.get('/pending', authenticateToken, authorizeRole('admin'), getPendingAppointments);

// ✅ Admin: contar por estado (derivado). Por defecto status=pending
router.get('/count', authenticateToken, authorizeRole('admin'), getAppointmentsCount);

// Worker: elegir slot -> confirmed
router.post('/:id/select', authenticateToken, authorizeRole('worker'), selectSlot);

// Admin: proponer hasta 3 slots -> proposed
router.post('/:id/propose', authenticateToken, authorizeRole('admin'), proposeSlots);

// Admin: calendario de confirmadas/rescheduled en rango
router.get('/calendar', authenticateToken, authorizeRole('admin'), getCalendarAppointments);

// Admin: editar (motivo/detalles y/o reprogramar -> rescheduled)
router.patch('/:id', authenticateToken, authorizeRole('admin'), updateAppointment);

// Worker: eliminar su propia cita si está cancelada o ya pasó
router.delete('/:id/my', authenticateToken, authorizeRole('worker'), deleteMyAppointment);

// Admin: cancelar -> cancelled
router.delete('/:id', authenticateToken, authorizeRole('admin'), cancelAppointment);

export default router;
