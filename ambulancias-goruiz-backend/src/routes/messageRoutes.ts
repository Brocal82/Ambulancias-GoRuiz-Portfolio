// backend/src/routes/messageRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import {
  createMessage,
  getMyMessages,
  getSentMessages,
  deleteMessageForUser,
  deleteMessageByAdmin,
  markMessageAsRead
} from '../controllers/messageController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import type { ErrorRequestHandler } from 'express';

const router = Router();

// ✅ Crear mensaje (admin). Soporta 1 adjunto opcional en el campo "attachment".
router.post(
  '/',
  authenticateToken,
  authorizeRole('admin'),
  upload.single('attachment'),
  createMessage
);

// ✅ Obtener mensajes del worker autenticado (no leídos / no borrados por él)
router.get('/', authenticateToken, authorizeRole('worker'), getMyMessages);

// ✅ Obtener mensajes enviados por el admin (a todos los trabajadores)
router.get('/sent', authenticateToken, authorizeRole('admin'), getSentMessages);

// ✅ Marcar como leído (no ocultar)
router.patch('/:id/read', authenticateToken, authorizeRole('worker'), markMessageAsRead);


// ✅ Marcar un mensaje como leído/borrado para el worker (solo afecta a ese usuario)
router.patch('/:id/remove', authenticateToken, authorizeRole('worker'), deleteMessageForUser);

// ✅ Borrar un mensaje globalmente (solo el admin remitente del mensaje)
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteMessageByAdmin);


// (Opcional) Manejo elegante de errores de subida (multer)
const multerErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: `Upload error: ${err.message}` });
    return; // 👈 terminamos sin devolver Response
  }

  if (err && typeof err.message === 'string' && err.message.includes('Tipo de archivo no permitido')) {
    res.status(400).json({ message: err.message });
    return; // 👈 terminamos sin devolver Response
  }

  res.status(500).json({ message: 'Unexpected server error' });
  // opcional: _next(err) si quieres delegar a otro handler
};

router.use(multerErrorHandler);

export default router;
