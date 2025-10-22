import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import {
  createSickLeave,
  listSickLeaves,
  listMySickLeaves,
} from '../controllers/sickLeaveController';

const router = express.Router();

// Crea una solicitud de baja (trabajador autenticado o admin)
router.post('/', authenticateToken, createSickLeave);

// Admin: lista todas (filtros opcionales ?status=&user=)
router.get('/', authenticateToken, authorizeRole('admin'), listSickLeaves);

// Worker: lista solo las suyas (?status= optional)
router.get('/me', authenticateToken, listMySickLeaves);

export default router;
