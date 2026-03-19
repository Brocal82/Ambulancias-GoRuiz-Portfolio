//backend/src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// JWT_SECRET es obligatorio y se valida en config/env.ts
const JWT_SECRET = env.JWT_SECRET;

interface JwtPayload {
  userId: string;
  role: string;
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Espera formato: Bearer <token>

  if (!token) {
    res.status(401).json({ message: "Token no proporcionado" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.userId = decoded.userId;
    req.userRole = decoded.role;

    // Compatibilidad: además de userId/userRole, rellenamos req.user
    req.user = {
      id: decoded.userId,
      email: "",
      role: decoded.role,
    };

    next();
  } catch (err) {
    res.status(403).json({ message: "Token inválido o expirado" });
  }

};
