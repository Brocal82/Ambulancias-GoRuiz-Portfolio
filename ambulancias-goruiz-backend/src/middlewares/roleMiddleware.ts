//backend/src/middlewares/roleMiddleware.ts
import { Request, Response, NextFunction } from "express";

type AppRole =
  | "admin"
  | "worker"
  | "mecanico"
  | "jefe_mecanicos"
  | "jefe_logistica"
  | "superadmin";

// Middleware para verificar que el usuario tiene el rol necesario
export const authorizeRole = (requiredRole: AppRole | AppRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req.userRole ?? req.user?.role) as AppRole | undefined;
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    if (userRole && requiredRoles.includes(userRole)) {
      next();
    } else {
      res.status(403).json({ message: "Acceso denegado: Rol insuficiente" });
    }
  };
};

/** Middleware para rutas exclusivas de superadmin. No depende de companyId. */
export const authorizeSuperadmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userRole = req.userRole ?? req.user?.role;
  if (userRole === "superadmin") {
    next();
  } else {
    res.status(403).json({ message: "Acceso denegado: se requiere rol superadmin" });
  }
};

// Middleware para permitir acceso al propio usuario o a un admin
export const authorizeSelfOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userIdFromToken = req.userId;
  const userRole = req.userRole;
  const userIdFromParams = req.params.id;

  if (userRole === "admin" || userIdFromToken === userIdFromParams) {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Acceso denegado. No eres el propietario ni admin." });
  }
};
