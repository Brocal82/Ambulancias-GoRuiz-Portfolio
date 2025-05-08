import { Router } from 'express';
import { createUser, getUsers, updateUser, getUserById, deleteUser, loginUser } from '../controllers/userController';

const router = Router();

router.post('/register', createUser);
router.post('/login', loginUser);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser)
router.delete('/:id', deleteUser)

export default router;
