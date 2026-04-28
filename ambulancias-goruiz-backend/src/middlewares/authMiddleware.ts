//backend/src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";

// JWT_SECRET es obligatorio y se valida en config/env.ts
const JWT_SECRET = env.JWT_SECRET;

interface JwtPayload {
  userId: string;
  role: string;
  companyId?: string;
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
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
    if (decoded.companyId) {
      req.companyId = decoded.companyId;
    }

    // Compatibilidad: además de userId/userRole, rellenamos req.user
    req.user = {
      id: decoded.userId,
      email: "",
      role: decoded.role,
      ...(decoded.companyId && { companyId: decoded.companyId }),
    };

    // Bloqueo operativo: si la empresa está desactivada, cualquier usuario
    // con rol de empresa (excepto superadmin) no puede operar aunque tenga token.
    if (decoded.role !== "superadmin" && decoded.companyId) {
      const company = await Company.findById(decoded.companyId)
        .select("isActive")
        .lean();
      if (!company || company.isActive !== true) {
        res.status(403).json({
          message:
            "Tu empresa no está activa. Contacta con soporte o con el superadmin para reactivarla.",
          code: "COMPANY_INACTIVE",
        });
        return;
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Token inválido o expirado" });
  }

};
