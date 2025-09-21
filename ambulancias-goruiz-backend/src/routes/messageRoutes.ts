// backend/src/routes/messageRoutes.ts
import { Router } from 'express';
import { createMessage, getMyMessages, getSentMessages, deleteMessageForUser, deleteMessageByAdmin } from '../controllers/messageController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';

const router = Router();

// ✅ Solo los admins pueden enviar mensajes
router.post('/', authenticateToken, authorizeRole('admin'), createMessage);

// ✅ Solo el usuario autenticado puede ver sus mensajes
router.get('/', authenticateToken, authorizeRole('worker'), getMyMessages);

// ✅ Solo el admin puede ver los mensajes que ha enviado a todos los trabajadores
router.get('/sent', authenticateToken, authorizeRole('admin'), getSentMessages);

// ✅ El trabajador puede marcar un mensaje como eliminado (solo para sí mismo)
router.patch('/:id/remove', authenticateToken, authorizeRole('worker'), deleteMessageForUser);

// ✅ El admin puede borrar un mensaje que él envió
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteMessageByAdmin);


export default router;
