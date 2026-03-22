import { Request, Response } from "express";
import mongoose from "mongoose";
import { getMonthlyHistoryForUser } from "../services/get-monthly-history.service";
import { getMonthlySummaryForUser } from "../services/get-monthly-summary.service";

type ResolvePraemienResult = string | null | { statusCode: 400; message: string };

/**
 * Resuelve el userId autorizado para consultar praemien.
 * - Admin: puede usar ?userId=X para consultar cualquier usuario; si no lo pasa, usa el suyo.
 * - Worker: solo puede consultar sus propios datos (ignora query.userId).
 * Si admin pasa ?userId inválido, devuelve error 400.
 */
function resolvePraemienUserId(req: Request): ResolvePraemienResult {
  const isAdmin = req.userRole === "admin";
  const requestedUserId = req.query.userId as string | undefined;

  if (isAdmin && requestedUserId) {
    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
      return { statusCode: 400, message: "userId inválido" };
    }
    return requestedUserId;
  }
  return req.userId ?? null;
}

function isErrorResult(
  r: ResolvePraemienResult,
): r is { statusCode: 400; message: string } {
  return typeof r === "object" && r !== null && "statusCode" in r;
}

export const getMonthlyPraemienSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = resolvePraemienUserId(req);
    if (isErrorResult(result)) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }
    if (!result) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const summary = await getMonthlySummaryForUser(result);
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
    const result = resolvePraemienUserId(req);
    if (isErrorResult(result)) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }
    if (!result) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const history = await getMonthlyHistoryForUser(result);
    res.status(200).json(history);
  } catch (error) {
    console.error("Error en getPraemienMonthlyHistory:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
