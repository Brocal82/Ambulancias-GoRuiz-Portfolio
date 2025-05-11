import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Puedes mover esta clave a una variable de entorno .env más adelante
const JWT_SECRET = 'tu_clave_secreta';

interface JwtPayload {
  userId: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Espera formato: Bearer <token>

  if (!token) {
    res.status(401).json({ message: 'Token no proporcionado' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).userId = decoded.userId; // Puedes extender tipos después
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token inválido o expirado' });
  }
};
