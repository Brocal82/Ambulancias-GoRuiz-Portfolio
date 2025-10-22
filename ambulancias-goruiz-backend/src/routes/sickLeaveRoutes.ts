import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import {
  createSickLeave,
  listSickLeaves,
  listMySickLeaves,
  acceptSickLeave
} from '../controllers/sickLeaveController';

const router = express.Router();

// Crea una solicitud de baja (trabajador autenticado o admin)
router.post('/', authenticateToken, createSickLeave);

// Admin: lista todas (filtros opcionales ?status=&user=)
router.get('/', authenticateToken, authorizeRole('admin'), listSickLeaves);

// Worker: lista solo las suyas (?status= optional)
router.get('/me', authenticateToken, listMySickLeaves);

// Admin: aceptar una solicitud y ejecutar desasignación
router.post('/:id/accept', authenticateToken, authorizeRole('admin'), acceptSickLeave);


export default router;
