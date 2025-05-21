
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

interface JwtPayload {
  userId: string;
  role: string;
}

// Middleware para verificar que el usuario tiene el rol necesario
export const authorizeRole = (requiredRole: 'admin' | 'worker') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ message: 'Token no proporcionado' });
        return
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      if (decoded.role !== requiredRole) {
        res.status(403).json({ message: 'Acceso denegado: Rol insuficiente' });
        return
      }

      // Si todo está bien, dejamos pasar
      next();
    } catch (error) {
        res.status(403).json({ message: 'Token inválido o expirado' });
        return
    }
  };
};
