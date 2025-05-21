import { Router } from 'express';
import { createUser, getUsers, updateUser, getUserById, deleteUser, loginUser } from '../controllers/userController';

import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole, authorizeSelfOrAdmin } from '../middlewares/roleMiddleware'; // 👈 también importamos authorizeSelfOrAdmin

const router = Router();

// Rutas públicas
router.post('/register', createUser);
router.post('/login', loginUser);

// Rutas protegidas
router.get('/', authenticateToken, authorizeRole('admin'), getUsers); // SOLO ADMIN
router.get('/:id', authenticateToken, authorizeSelfOrAdmin, getUserById); // 👈 propio usuario o admin
router.put('/:id', authenticateToken, authorizeSelfOrAdmin, updateUser); // 👈 propio usuario o admin
router.delete('/:id', authenticateToken, authorizeSelfOrAdmin, deleteUser); // 👈 propio usuario o admin

export default router;
