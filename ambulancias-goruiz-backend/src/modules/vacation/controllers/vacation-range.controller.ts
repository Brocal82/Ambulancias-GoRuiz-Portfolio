import { Request, Response } from "express";
import User from "../../users/models/user.model";
import {
  isSameCompany,
  requireCompanyForAdmin,
} from "../../../utils/requireCompany";
import { checkVacationsInRangeService } from "../services/vacation-range.service";

export const checkVacationsInRange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userIds, fromISO, toISO } = req.body;
    const userRole = req.userRole;
    const userId = req.userId;

    if (userRole === "worker" && !userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    let effectiveUserIds: string[];
    if (userRole === "admin") {
      const companyResult = requireCompanyForAdmin(req);
      if (!companyResult.ok) {
        res
          .status(companyResult.statusCode)
          .json({ message: companyResult.message });
        return;
      }

      const rawIds: string[] = Array.isArray(userIds) ? userIds : [];
      const uniqueIds = [...new Set(rawIds)];

      const found = await User.find({ _id: { $in: uniqueIds } })
        .select("companyId")
        .lean();

      if (found.length !== uniqueIds.length) {
        res.status(404).json({ message: "Usuario no encontrado" });
        return;
      }

      for (const u of found) {
        const co = (u as { companyId?: unknown }).companyId;
        if (!isSameCompany(co, companyResult.companyId)) {
          res.status(403).json({
            message:
              "No tienes permiso para consultar vacaciones de uno o más usuarios",
          });
          return;
        }
      }

      effectiveUserIds = Array.isArray(userIds) ? userIds : [];
    } else {
      effectiveUserIds = userId ? [userId] : [];
    }

    if (userRole !== "admin" && Array.isArray(userIds) && userIds.length > 1) {
      console.warn("⚠️ Worker intentó consultar múltiples usuarios", {
        userId,
        attemptedUserIds: userIds,
      });
    }

    const result = await checkVacationsInRangeService({
      userIds: effectiveUserIds,
      fromISO,
      toISO,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error en checkVacationsInRange:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
