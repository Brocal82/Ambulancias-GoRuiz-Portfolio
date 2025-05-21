import { Router } from 'express';
import { createUser, getUsers, updateUser, getUserById, deleteUser, loginUser } from '../controllers/userController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware'; // NUEVO


const router = Router();

// Rutas públicas
router.post('/register', createUser);
router.post('/login', loginUser);

// Rutas protegidas
router.get('/', authenticateToken, authorizeRole('admin'), getUsers); // SOLO ADMIN
router.get('/:id', authenticateToken, getUserById); // Cualquier usuario autenticado
router.put('/:id', authenticateToken, updateUser); // Cualquier usuario autenticado
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteUser); // Cualquier usuario autenticado

export default router;
