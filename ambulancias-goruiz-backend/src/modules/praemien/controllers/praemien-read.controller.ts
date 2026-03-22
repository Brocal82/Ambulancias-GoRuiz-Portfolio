import { Request, Response } from "express";
import { getMonthlyHistoryForUser } from "../services/get-monthly-history.service";
import { getMonthlySummaryForUser } from "../services/get-monthly-summary.service";

/**
 * Resuelve el userId autorizado para consultar praemien.
 * - Admin: puede usar ?userId=X para consultar cualquier usuario; si no lo pasa, usa el suyo.
 * - Worker: solo puede consultar sus propios datos (ignora query.userId).
 */
function resolvePraemienUserId(req: Request): string | null {
  const isAdmin = req.userRole === "admin";
  const requestedUserId = req.query.userId as string | undefined;
  return isAdmin && requestedUserId ? requestedUserId : req.userId ?? null;
}

export const getMonthlyPraemienSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = resolvePraemienUserId(req);
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const summary = await getMonthlySummaryForUser(userId);
    res.status(200).json(summary);
  } catch (error) {
    console.error("Error en getMonthlyPraemienSummary:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getPraemienMonthlyHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = resolvePraemienUserId(req);
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const history = await getMonthlyHistoryForUser(userId);
    res.status(200).json(history);
  } catch (error) {
    console.error("Error en getPraemienMonthlyHistory:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
