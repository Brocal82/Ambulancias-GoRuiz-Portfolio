import { Router } from 'express';
import {
  createUser,
  getUsers,
  updateUser,
  getUserById,
  deleteUser,
  loginUser,
  getAllUsersDienst,
  getAvailableUsersForDate // 👈 importa aquí también
} from '../controllers/userController';

import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole, authorizeSelfOrAdmin } from '../middlewares/roleMiddleware';

const router = Router();

// Rutas públicas
router.post('/register', createUser);
router.post('/login', loginUser);

// ⚠️ Rutas personalizadas antes de `/:id`
router.get('/diensts', authenticateToken, authorizeRole('admin'), getAllUsersDienst); // ✅ ya existente
router.get('/available', authenticateToken, authorizeRole('admin'), getAvailableUsersForDate); // ✅ nueva ruta

// Ruta para actualizar el perfil del usuario autenticado
router.patch('/me', authenticateToken, updateUser);

// Rutas protegidas para usuarios
router.get('/', authenticateToken, authorizeRole('admin'), getUsers);
router.get('/:id', authenticateToken, authorizeSelfOrAdmin, getUserById);
router.put('/:id', authenticateToken, authorizeSelfOrAdmin, updateUser);
router.patch('/:id', authenticateToken, authorizeSelfOrAdmin, updateUser);


router.delete('/:id', authenticateToken, authorizeSelfOrAdmin, deleteUser);

export default router;
