//backend/src/middlewares/roleMiddleware.ts
import { Request, Response, NextFunction } from "express";

// Middleware para verificar que el usuario tiene el rol necesario
export const authorizeRole = (requiredRole: "admin" | "worker") => {
  return (req: Request, res: Response, next: NextFunction): void => {
const userRole = (req as any).userRole ?? req.user?.role;

    if (userRole === requiredRole) {
      next();
    } else {
      res.status(403).json({ message: "Acceso denegado: Rol insuficiente" });
    }
  };
};

// Middleware para permitir acceso al propio usuario o a un admin
export const authorizeSelfOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userIdFromToken = (req as any).userId;
  const userRole = (req as any).userRole;
  const userIdFromParams = req.params.id;

  if (userRole === "admin" || userIdFromToken === userIdFromParams) {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Acceso denegado. No eres el propietario ni admin." });
  }
};
