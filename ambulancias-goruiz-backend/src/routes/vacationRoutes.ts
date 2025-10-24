//src/routes/vacationRoutes.ts
import { Router } from 'express';
import {
  getUserVacationRequests,
  getVacationRequests,
  createVacationRequest,
  updateVacationRequest,
  respondToAlternativeDate,
  deleteVacationRequest,
  getVacationPendingCount,
  // NUEVO
  getAvailability,
  getMonthConfig,
  upsertMonthConfig,
  checkVacationsInRange
} from '../controllers/vacationController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// --- NUEVO: Disponibilidad mensual (worker/admin) ---
router.get('/availability', authenticateToken, getAvailability);

// --- NUEVO: Chequear vacaciones en un rango (worker/admin) ---
router.post('/check-range', authenticateToken, checkVacationsInRange);


// --- NUEVO: Config mensual (admin) ---
router.get('/month-config', authenticateToken, authorizeRole('admin'), getMonthConfig);
router.post('/month-config', authenticateToken, authorizeRole('admin'), upsertMonthConfig);

// El trabajador crea una solicitud
router.post('/', authenticateToken, createVacationRequest);

// El admin puede obtener todas las solicitudes
router.get('/', authenticateToken, authorizeRole('admin'), getVacationRequests);

// --- NUEVO: Count pendiente (derivado, solo admin) ---
// GET /vacations/count?status=pending -> { count: number }
router.get('/count', authenticateToken, authorizeRole('admin'), getVacationPendingCount);

// El admin puede actualizar estado y enviar fechas alternativas
router.patch('/:id', authenticateToken, authorizeRole('admin'), updateVacationRequest);

// El trabajador responde a propuesta alternativa (aceptar o rechazar)
router.post('/:id/respond', authenticateToken, respondToAlternativeDate);

// Ruta para que el trabajador obtenga sus solicitudes
router.get('/user', authenticateToken, getUserVacationRequests);

// DELETE solicitud de vacaciones (solo admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteVacationRequest);

export default router;
