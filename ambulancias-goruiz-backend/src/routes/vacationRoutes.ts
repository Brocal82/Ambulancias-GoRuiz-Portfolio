import { Router } from 'express';
import { getVacationRequests, createVacationRequest, updateVacationRequest, respondToAlternativeDate } from '../controllers/vacationController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// El trabajador crea una solicitud
router.post('/', authenticateToken, createVacationRequest);

// El admin puede obtener todas las solicitudes
router.get('/', authenticateToken, authorizeRole('admin'), getVacationRequests);

// El admin puede actualizar estado y enviar fechas alternativas
router.patch('/:id', authenticateToken, authorizeRole('admin'), updateVacationRequest);

// El trabajador responde a propuesta alternativa (aceptar o rechazar)
router.post('/:id/respond', authenticateToken, respondToAlternativeDate);

export default router;
