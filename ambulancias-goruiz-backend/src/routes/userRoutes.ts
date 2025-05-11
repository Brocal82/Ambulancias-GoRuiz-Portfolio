import { Router } from 'express';
import { createUser, getUsers, updateUser, getUserById, deleteUser, loginUser } from '../controllers/userController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', createUser);
router.post('/login', loginUser);

router.get('/', authenticateToken, getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser)
router.delete('/:id', deleteUser)

export default router;
