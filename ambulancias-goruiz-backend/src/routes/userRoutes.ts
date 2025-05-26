import { Router } from 'express';
import {
  createUser,
  getUsers,
  updateUser,
  getUserById,
  deleteUser,
  loginUser,
  getAllUsersDienst // 👈 nuevo import
} from '../controllers/userController';

import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole, authorizeSelfOrAdmin } from '../middlewares/roleMiddleware';

const router = Router();

// Rutas públicas
router.post('/register', createUser);
router.post('/login', loginUser);

// ⚠️ RUTA PERSONALIZADA antes de `/:id`
router.get('/diensts', authenticateToken, authorizeRole('admin'), getAllUsersDienst); // 👈 nueva ruta

// Rutas protegidas para usuarios
router.get('/', authenticateToken, authorizeRole('admin'), getUsers);
router.get('/:id', authenticateToken, authorizeSelfOrAdmin, getUserById);
router.put('/:id', authenticateToken, authorizeSelfOrAdmin, updateUser);
router.delete('/:id', authenticateToken, authorizeSelfOrAdmin, deleteUser);

export default router;
