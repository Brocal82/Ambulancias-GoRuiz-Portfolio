// backend/src/routes/messageRoutes.ts
import { Router } from 'express';
import { createMessage, getMyMessages } from '../controllers/messageController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// ✅ Solo los admins pueden enviar mensajes
router.post('/', authenticateToken, authorizeRole('admin'), createMessage);

// ✅ Solo el usuario autenticado puede ver sus mensajes
router.get('/', authenticateToken, authorizeRole('worker'), getMyMessages);

export default router;
