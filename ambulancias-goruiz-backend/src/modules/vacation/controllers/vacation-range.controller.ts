import { Request, Response } from "express";
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
      effectiveUserIds = userIds ?? [];
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
