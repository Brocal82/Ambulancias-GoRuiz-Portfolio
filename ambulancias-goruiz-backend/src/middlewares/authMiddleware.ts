//backend/src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";
import User from "../modules/users/models/user.model";
import UserSessionState from "../modules/users/models/user-session-state.model";

// JWT_SECRET es obligatorio y se valida en config/env.ts
const JWT_SECRET = env.JWT_SECRET;

interface JwtPayload {
  userId: string;
  role: string;
  companyId?: string;
  tokenVersion?: number;
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

    // Step-up tokens are single-purpose (MFA confirmation only) and must not
    // be used as general API Bearer tokens.
    if ((decoded as any).typ === "step_up") {
      res.status(401).json({ message: "Token inválido o expirado" });
      return;
    }

    const userDoc = await User.findById(decoded.userId)
      .select("role companyId tokenVersion isActive")
      .lean();
    if (!userDoc || userDoc.isActive !== true) {
      res.status(401).json({ message: "Token inválido o expirado" });
      return;
    }
    const sessionState = await UserSessionState.findOne({ userId: decoded.userId })
      .select("tokenVersion")
      .lean();
    const persistedTokenVersion = Number((sessionState as any)?.tokenVersion ?? 0);
    if (persistedTokenVersion !== (decoded.tokenVersion ?? 0)) {
      res.status(401).json({ message: "Token inválido o expirado" });
      return;
    }
    if (String(userDoc.role) !== String(decoded.role)) {
      res.status(401).json({ message: "Token inválido o expirado" });
      return;
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    const resolvedCompanyId = decoded.companyId;
    if (resolvedCompanyId) {
      req.companyId = resolvedCompanyId;
    }

    // Compatibilidad: además de userId/userRole, rellenamos req.user
    req.user = {
      id: decoded.userId,
      email: "",
      role: decoded.role,
      ...(resolvedCompanyId && { companyId: resolvedCompanyId }),
    };

    // Bloqueo operativo: si la empresa está desactivada, cualquier usuario
    // con rol de empresa (excepto superadmin) no puede operar aunque tenga token.
    if (decoded.role !== "superadmin" && resolvedCompanyId) {
      const company = await Company.findById(resolvedCompanyId)
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
