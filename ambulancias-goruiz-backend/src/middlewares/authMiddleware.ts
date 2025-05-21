import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Cargar la clave secreta desde las variables de entorno (.env)
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret'; // 'default_secret' es un valor por defecto si no se encuentra en el .env


interface JwtPayload {
  userId: string;
  role: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Espera formato: Bearer <token>

  if (!token) {
    res.status(401).json({ message: 'Token no proporcionado' });
    return;
  }

  try {
    // Verificar el token usando la clave secreta
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).userId = decoded.userId; // Puedes extender tipos después
    (req as any).userRole = decoded.role;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token inválido o expirado' });
  }
};
