import express from 'express';
import {
  createDienst,
  getAllDiensts,
  getDienstById,
  updateDienst,
  updateDienstPartial,
  deleteDienst,
  searchDienst,
  getDienstsByUser,
  removeAssignment, // ✅ 👈 añade esta función al import
} from '../controllers/dienstController';

import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = express.Router();

// 👮‍♂️ Rutas protegidas
router.post('/', authenticateToken, authorizeRole('admin'), createDienst);
router.get('/', authenticateToken, authorizeRole('admin'), getAllDiensts);
router.get('/search', authenticateToken, authorizeRole('admin'), searchDienst);
router.get('/user/:userId', authenticateToken, getDienstsByUser);

// 👇 Acceso según permisos
router.get('/:id', authenticateToken, getDienstById);
router.put('/:id', authenticateToken, authorizeRole('admin'), updateDienst);

// ✅ Nueva ruta para eliminar un assignment específico
router.patch('/:id/remove-assignment', authenticateToken, authorizeRole('admin'), removeAssignment);

router.patch('/:id', authenticateToken, authorizeRole('admin'), updateDienstPartial);
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteDienst);

export default router;

